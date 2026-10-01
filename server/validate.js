const MIN_FIELD_CHARS = 30;

/**
 * Checks the cover-letter request body for:
 * missing fields, wrong data types, empty/whitespace-only values
 * and unreasonable field sizes.
 *
 * Returns null when the input is valid, otherwise { status, body }.
 */
export function validateCoverLetterRequest(resume, jobDescription, maxFieldChars) {
  const errors = [];

  for (const [field, value] of [
    ["resume", resume],
    ["jobDescription", jobDescription],
  ]) {
    if (value === undefined || value === null) {
      errors.push(`"${field}" is required.`);
      continue;
    }
    if (typeof value !== "string") {
      errors.push(`"${field}" must be a string.`);
      continue;
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      errors.push(`"${field}" must not be empty or whitespace only.`);
      continue;
    }
    if (trimmed.length < MIN_FIELD_CHARS) {
      errors.push(`"${field}" must be at least ${MIN_FIELD_CHARS} characters.`);
    }
    if (trimmed.length > maxFieldChars) {
      errors.push(`"${field}" must not exceed ${maxFieldChars} characters.`);
    }
  }

  if (errors.length > 0) {
    return { status: 400, body: { error: "Invalid request.", details: errors } };
  }
  return null;
}
