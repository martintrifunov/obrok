import { ValidationError } from "../errors/ValidationError.js";

/**
 * Creates a Zod validation middleware.
 *
 * @param {import("zod").ZodSchema} schema - Zod schema to validate against
 * @param {"body" | "params" | "query"} source - Part of request to validate
 */
export const validateRequest = (schema, source = "body") => {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const formattedErrors = {};

      result.error.issues.forEach((issue) => {
        const key = issue.path.length > 0 ? issue.path.join(".") : "message";

        if (!formattedErrors[key]) {
          let msg = issue.message;

          // Replace only Zod's default wording, so schema messages come through.
          if (issue.code === "invalid_type" && msg.startsWith("Invalid input")) {
            msg = "This field cannot be blank.";
          }

          formattedErrors[key] = msg;
        }
      });

      if (Object.keys(formattedErrors).length === 0) {
        formattedErrors.message = "Invalid input data.";
      }

      return next(new ValidationError(formattedErrors));
    }

    if (source === "query") {
      Object.defineProperty(req, "query", {
        value: result.data,
        writable: true,
        configurable: true,
      });
    } else {
      req[source] = result.data;
    }

    next();
  };
};
