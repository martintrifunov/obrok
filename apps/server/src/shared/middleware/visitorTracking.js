import { randomUUID } from "crypto";

const VISITOR_COOKIE = "obrok_vid";
const VISITOR_HEADER = "x-visitor-id";
const COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 90;

const isLikelyValidVisitorId = (value) =>
  typeof value === "string" && /^[A-Za-z0-9-]{12,64}$/.test(value);

const visitorTracking = (req, res, next) => {
  const cookieId = req.cookies?.[VISITOR_COOKIE];
  const headerId = req.get(VISITOR_HEADER);

  const visitorId = isLikelyValidVisitorId(cookieId)
    ? cookieId
    : isLikelyValidVisitorId(headerId)
      ? headerId
      : randomUUID();

  if (cookieId !== visitorId) {
    res.cookie(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: COOKIE_MAX_AGE_MS,
    });
  }

  req.visitorId = visitorId;
  next();
};

export default visitorTracking;
