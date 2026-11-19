import { prisma } from "./prisma";
import { cacheDel, cacheDelPrefix, cacheGet, cacheSet, CACHE_TTL } from "./appCache";

export async function getInterviewWithQuestions(interviewId) {
  const key = `interview:${interviewId}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: {
      questions: {
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  if (interview) cacheSet(key, interview);
  return interview;
}

export function invalidateInterview(interviewId) {
  if (interviewId) cacheDel(`interview:${interviewId}`);
}

export async function getCohortFlags(cohortId) {
  const key = `cohort:${cohortId}:flags`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const cohort = await prisma.cohort.findUnique({
    where: { id: cohortId },
    select: {
      id: true,
      isActive: true,
      isPublished: true,
      resultsPublished: true,
      resultsShowAttempt: true,
      resultsShowCorrect: true,
      openTime: true,
      closeTime: true,
      name: true,
    },
  });

  if (cohort) cacheSet(key, cohort, CACHE_TTL.cohortFlags);
  return cohort;
}

export function invalidateCohort(cohortId) {
  if (cohortId) cacheDel(`cohort:${cohortId}:flags`);
  cacheDelPrefix("enrollment:");
}

export async function getEnrollmentByAccessKey(accessKey) {
  const key = `enrollment:${accessKey}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const enrollment = await prisma.cohortEnrollment.findFirst({
    where: { accessKey },
    include: {
      candidate: true,
      cohort: {
        include: {
          interviews: {
            include: {
              interview: {
                select: {
                  id: true,
                  type: true,
                  durationMinutes: true,
                  instructions: true,
                  totalQuestions: true,
                  isActive: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (enrollment) cacheSet(key, enrollment, CACHE_TTL.enrollment);
  return enrollment;
}

export function invalidateEnrollment(accessKey) {
  if (accessKey) cacheDel(`enrollment:${accessKey}`);
}
