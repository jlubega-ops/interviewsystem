"use client";

import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { getSubmissionReasonLabel } from "../lib/submissionReasons";

export const generatePDF = async (data, filename = "interview-results.pdf") => {
  try {
    // Create a temporary div to hold the content
    const tempDiv = document.createElement("div");
    tempDiv.style.position = "absolute";
    tempDiv.style.left = "-9999px";
    tempDiv.style.top = "0";
    tempDiv.style.width = "800px";
    tempDiv.style.backgroundColor = "white";
    tempDiv.style.padding = "20px";
    tempDiv.style.fontFamily = "Arial, sans-serif";

    // Generate HTML content
    const htmlContent = generateHTMLContent(data);
    tempDiv.innerHTML = htmlContent;

    // Append to body temporarily
    document.body.appendChild(tempDiv);

    // Convert to canvas
    const canvas = await html2canvas(tempDiv, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
    });

    // Remove temp div
    document.body.removeChild(tempDiv);

    // Create PDF
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const imgWidth = 210;
    const pageHeight = 295;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;

    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // Save the PDF
    pdf.save(filename);
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw error;
  }
};

const generateHTMLContent = (data) => {
  const { interview, results } = data;

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2563eb; padding-bottom: 20px;">
        <h1 style="color: #2563eb; margin: 0; font-size: 24px;">Interview Results Report</h1>
        <h2 style="color: #374151; margin: 10px 0 0 0; font-size: 18px;">${
          interview?.type
        } Interview</h2>
        <p style="color: #6b7280; margin: 5px 0 0 0; font-size: 14px;">
          Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
        </p>
      </div>

      <!-- Interview Summary -->
      <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 25px;">
        <h3 style="color: #1f2937; margin: 0 0 10px 0; font-size: 16px;">Interview Summary</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 14px;">
          <div><strong>Interview Type:</strong> ${interview?.type}</div>
          <div><strong>Total Questions:</strong> ${
            interview?.questions?.length || 0
          }</div>
          <div><strong>Total Attempts:</strong> ${results?.length || 0}</div>
          <div><strong>Total Points:</strong> ${
            interview?.questions?.reduce((sum, q) => sum + q.points, 0) || 0
          }</div>
        </div>
      </div>

      <!-- Results Summary Table -->
      <div style="margin-bottom: 25px;">
        <h3 style="color: #1f2937; margin: 0 0 15px 0; font-size: 16px;">Results Summary</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Candidate</th>
              <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Email</th>
              <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Status</th>
              <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Submission Reason</th>
              <th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Score</th>
              <th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Percentage</th>
              <th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Duration</th>
            </tr>
          </thead>
          <tbody>
            ${
              results
                ?.map(
                  (result) => `
              <tr>
                <td style="border: 1px solid #d1d5db; padding: 8px;">${
                  result.candidateName
                }</td>
                <td style="border: 1px solid #d1d5db; padding: 8px;">${
                  result.candidateEmail
                }</td>
                <td style="border: 1px solid #d1d5db; padding: 8px;">
                  <span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; 
                    ${
                      result.status === "COMPLETED"
                        ? "background-color: #dcfce7; color: #166534;"
                        : result.status === "IN_PROGRESS"
                        ? "background-color: #fef3c7; color: #92400e;"
                        : result.status === "STARTED"
                        ? "background-color: #dbeafe; color: #1e40af;"
                        : "background-color: #fee2e2; color: #991b1b;"
                    }">
                    ${result.status.replace("_", " ")}
                  </span>
                </td>
                <td style="border: 1px solid #d1d5db; padding: 8px;">${getSubmissionReasonLabel(result.submissionReason)}</td>
                <td style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">${
                  result.score
                } / ${result.totalPoints}</td>
                <td style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">${Math.round(
                  (result.score / result.totalPoints) * 100
                )}%</td>
                <td style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">${
                  result.duration
                } min</td>
              </tr>
            `
                )
                .join("") ||
              '<tr><td colspan="7" style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">No results available</td></tr>'
            }
          </tbody>
        </table>
      </div>

      <!-- Detailed Results -->
      ${
        results
          ?.map(
            (result, index) => `
        <div style="page-break-inside: avoid; margin-bottom: 30px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px;">
          <h4 style="color: #1f2937; margin: 0 0 15px 0; font-size: 14px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">
            Candidate ${index + 1}: ${result.candidateName}
          </h4>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; font-size: 12px;">
            <div><strong>Email:</strong> ${result.candidateEmail}</div>
            <div><strong>Access Key:</strong> ${result.accessKey}</div>
            <div><strong>Status:</strong> ${result.status.replace(
              "_",
              " "
            )}</div>
            <div><strong>Submission Reason:</strong> ${getSubmissionReasonLabel(result.submissionReason)}</div>
            <div><strong>Score:</strong> ${result.score} / ${
              result.totalPoints
            } (${Math.round((result.score / result.totalPoints) * 100)}%)</div>
            <div><strong>Questions Answered:</strong> ${
              result.answeredQuestions
            } / ${result.totalQuestions}</div>
            <div><strong>Duration:</strong> ${result.duration} minutes</div>
            ${
              interview?.type === "TYPING" && result.typingStats
                ? `
            <div><strong>Net WPM:</strong> ${
              result.typingStats.netWordsPerMinute ?? result.typingStats.wordsPerMinute ?? 0
            } WPM</div>
            <div><strong>Accuracy:</strong> ${
              result.typingStats.accuracy || 0
            }%</div>
            <div><strong>Words Typed:</strong> ${
              result.typingStats.wordsTyped || 0
            }</div>
            <div><strong>Characters Typed:</strong> ${
              result.typingStats.charactersTyped || 0
            }</div>
            `
                : ""
            }
          </div>

          ${
            result.questions?.length > 0
              ? `
            <h5 style="color: #374151; margin: 15px 0 10px 0; font-size: 13px;">${
              interview?.type === "TYPING"
                ? "Typing Performance"
                : "Question Responses"
            }:</h5>
            <div style="font-size: 11px;">
              ${result.questions
                .map(
                  (q, qIndex) => `
                <div style="margin-bottom: 12px; padding: 8px; background-color: #f9fafb; border-radius: 4px;">
                  <div style="font-weight: bold; margin-bottom: 5px;">
                    ${
                      interview?.type === "TYPING"
                        ? "Typing Test"
                        : `Question ${q.questionNumber}`
                    }: ${q.questionText.replace(/<[^>]*>/g, "")}
                  </div>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div><strong>Student Answer:</strong> ${
                      q.candidateAnswer || "No answer"
                    }</div>
                    ${
                      interview?.type === "TYPING"
                        ? `
                    <div><strong>Typed Text:</strong> ${
                      q.userAnswer || "No text recorded"
                    }</div>
                    <div><strong>Net WPM:</strong> ${
                      q.typingStats?.netWordsPerMinute ?? q.typingStats?.wordsPerMinute ?? 0
                    } WPM</div>
                    <div><strong>Accuracy:</strong> ${
                      q.typingStats?.accuracy || 0
                    }%</div>
                    `
                        : `
                    <div><strong>Correct Answer:</strong> ${
                      q.correctAnswer
                    }</div>
                    <div><strong>Points:</strong> ${q.pointsEarned} / ${
                            q.points
                          }</div>
                    <div><strong>Status:</strong> 
                      <span style="color: ${
                        q.isCorrect ? "#059669" : "#dc2626"
                      };">
                        ${q.isCorrect ? "Correct" : "Incorrect"}
                      </span>
                    </div>
                    `
                    }
                  </div>
                </div>
              `
                )
                .join("")}
            </div>
          `
              : '<p style="font-size: 12px; color: #6b7280;">No question responses available</p>'
          }
        </div>
      `
          )
          .join("") ||
        '<p style="text-align: center; color: #6b7280;">No detailed results available</p>'
      }

      <!-- Footer -->
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">
        <p>Generated by MUBS EIIC Interview System</p>
        <p>This report contains confidential information and should be handled securely.</p>
      </div>
    </div>
  `;
};
