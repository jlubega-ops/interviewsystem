import { prisma } from "./prisma";

export async function findActiveOrganisationByName(name) {
  if (!name || typeof name !== "string") return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  return prisma.organisation.findFirst({
    where: {
      name: trimmed,
      isActive: true,
    },
  });
}

export async function assertOrganisationName(name, { required = false } = {}) {
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) {
    if (required) {
      return { error: "Organisation is required", name: null };
    }
    return { error: null, name: null };
  }
  const org = await findActiveOrganisationByName(trimmed);
  if (!org) {
    return { error: "Select an organisation from the list", name: null };
  }
  return { error: null, name: org.name };
}
