import { NextResponse } from "next/server";
import { requireApiUser } from "../../../../lib/apiAuth";
import { invalidateCohort } from "../../../../lib/cachedReads";
import { prisma } from "../../../../lib/prisma";
import { generateAccessKey, validateAccessKeyChars } from "../../../../lib/tokenUtils";
import { parseSpreadsheetBuffer } from "../../../../lib/spreadsheet";
import { createLog, getRequestMeta, ACTION_TYPES } from "../../../../lib/activityLog.js";

export const runtime = "nodejs";

// POST /api/cohorts/upload-candidates - Bulk upload candidates from Excel file
export async function POST(request) {
  try {
    const auth = await requireApiUser(request);
    if (auth.response) return auth.response;
    const formData = await request.formData();
    const file = formData.get("file");
    const cohortId = formData.get("cohortId");

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    if (!cohortId) {
      return NextResponse.json(
        { success: false, error: "Cohort ID is required" },
        { status: 400 }
      );
    }

    // Verify cohort exists
    const cohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
    });

    if (!cohort) {
      return NextResponse.json(
        { success: false, error: "Cohort not found" },
        { status: 404 }
      );
    }

    const buffer = await file.arrayBuffer();
    let data;
    try {
      data = await parseSpreadsheetBuffer(buffer, file.name || "");
    } catch (parseError) {
      return NextResponse.json(
        {
          success: false,
          error: parseError.message || "Failed to parse spreadsheet",
        },
        { status: 400 }
      );
    }

    if (data.length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: "File must contain at least a header row and one data row",
        },
        { status: 400 }
      );
    }

    // Get headers and validate
    const headers = data[0].map((h) => h?.toString().toLowerCase().trim());
    const requiredColumns = ["name", "email"];
    const hasAccessCode =
      headers.includes("access code") || headers.includes("access_code");

    // Validate required columns
    const missingColumns = requiredColumns.filter(
      (col) => !headers.includes(col)
    );
    if (missingColumns.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Missing required columns: ${missingColumns.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Get column indices
    const nameIndex = headers.indexOf("name");
    const emailIndex = headers.indexOf("email");
    const phoneIndex = headers.indexOf("phone");
    const accessCodeIndex = hasAccessCode
      ? headers.indexOf("access code") !== -1
        ? headers.indexOf("access code")
        : headers.indexOf("access_code")
      : -1;

    // Process candidates
    const results = {
      successCount: 0,
      skippedCount: 0,
      errorCount: 0,
      successMessages: [],
      errorMessages: [],
    };

    // Process each row (skip header)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // Skip empty rows
      if (!row || row.every((cell) => !cell || cell.toString().trim() === "")) {
        continue;
      }

      const name = row[nameIndex]?.toString().trim();
      const email = row[emailIndex]?.toString().trim().toLowerCase();
      const phone = phoneIndex >= 0 ? row[phoneIndex]?.toString().trim() : "";
      const accessCode =
        accessCodeIndex !== -1 ? row[accessCodeIndex]?.toString().trim() : "";

      if (accessCode) {
        const validation = validateAccessKeyChars(accessCode);
        if (!validation.valid) {
          results.errorCount++;
          results.errorMessages.push(`Row ${i + 1}: ${validation.error}`);
          continue;
        }
      }

      // Validate required fields
      if (!name || !email) {
        results.errorCount++;
        results.errorMessages.push(`Row ${i + 1}: Name and email are required`);
        continue;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        results.errorCount++;
        results.errorMessages.push(
          `Row ${i + 1}: Invalid email format for ${email}`
        );
        continue;
      }

      try {
        // Check if candidate exists
        const existingCandidate = await prisma.candidate.findUnique({
          where: { email },
        });

        let candidate;
        let accessKey;

        if (existingCandidate) {
          // Check if name matches
          if (existingCandidate.fullName !== name) {
            results.errorCount++;
            results.errorMessages.push(
              `Row ${
                i + 1
              }: Candidate with email ${email} exists but with different name (${
                existingCandidate.fullName
              })`
            );
            continue;
          }

          // Use existing candidate
          candidate = existingCandidate;
          results.skippedCount++;
          results.successMessages.push(
            `Row ${i + 1}: Using existing candidate ${name} (${email})`
          );
        } else {
          // Create new candidate (normalize user-provided code to uppercase)
          accessKey = accessCode
            ? accessCode.trim().toUpperCase()
            : generateAccessKey();

          // Check if access key is unique
          if (accessCode) {
            const existingEnrollment = await prisma.cohortEnrollment.findFirst(
              {
                where: { accessKey },
              }
            );

            if (existingEnrollment) {
              results.errorCount++;
              results.errorMessages.push(
                `Row ${i + 1}: Access code ${accessCode} is already in use`
              );
              continue;
            }
          }

          candidate = await prisma.candidate.create({
            data: {
              fullName: name,
              email,
              phone: phone || null,
            },
          });

          results.successCount++;
          results.successMessages.push(
            `Row ${i + 1}: Created new candidate ${name} (${email})`
          );
        }

        // Check if candidate is already enrolled in this cohort
        const existingEnrollment = await prisma.cohortEnrollment.findFirst({
          where: {
            cohortId: cohortId,
            candidateId: candidate.id,
          },
        });

        if (existingEnrollment) {
          results.skippedCount++;
          results.successMessages.push(
            `Row ${i + 1}: ${name} is already enrolled in this cohort`
          );
          continue;
        }

        // Generate access key if not provided
        if (!accessKey) {
          accessKey = accessCode
            ? accessCode.trim().toUpperCase()
            : generateAccessKey();

          // Ensure access key is unique
          let isUnique = false;
          let attempts = 0;
          while (!isUnique && attempts < 10) {
            const existingKey = await prisma.cohortEnrollment.findUnique({
              where: { accessKey },
            });

            if (!existingKey) {
              isUnique = true;
            } else {
              accessKey = generateAccessKey();
              attempts++;
            }
          }

          if (!isUnique) {
            results.errorCount++;
            results.errorMessages.push(
              `Row ${i + 1}: Unable to generate unique access code for ${name}`
            );
            continue;
          }
        }

        // Enroll candidate in cohort
        await prisma.cohortEnrollment.create({
          data: {
            cohortId: cohortId,
            candidateId: candidate.id,
            accessKey,
          },
        });

        if (!existingCandidate) {
          results.successMessages.push(
            `Row ${i + 1}: Enrolled ${name} with access code ${accessKey}`
          );
        } else {
          results.successMessages.push(
            `Row ${
              i + 1
            }: Enrolled existing candidate ${name} with access code ${accessKey}`
          );
        }
      } catch (error) {
        console.error(`Error processing row ${i + 1}:`, error);
        results.errorCount++;
        results.errorMessages.push(
          `Row ${i + 1}: Error processing ${name} - ${error.message}`
        );
      }
    }

    const actorId = auth.user.id;
    const actorRole = auth.user.role;
    const actor = actorId ? await prisma.user.findUnique({ where: { id: actorId }, select: { fullName: true, email: true, organisation: true } }) : null;
    await createLog({
      actorType: "USER",
      userId: actorId,
      actorName: actor?.fullName ?? null,
      actorEmail: actor?.email ?? null,
      actorOrg: actor?.organisation ?? null,
      actorRole: actorRole ?? null,
      actionType: ACTION_TYPES.UPLOAD_CANDIDATES,
      resource: "cohort",
      description: `Uploaded candidates to cohort "${cohort.name}": ${results.successCount} added, ${results.skippedCount} skipped, ${results.errorCount} errors`,
      ...getRequestMeta(request),
    });

    invalidateCohort(cohortId);

    return NextResponse.json({
      success: true,
      message: "Bulk upload completed",
      ...results,
    });
  } catch (error) {
    console.error("Bulk upload error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process file" },
      { status: 500 }
    );
  }
}
