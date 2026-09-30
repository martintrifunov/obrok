import jwt from "jsonwebtoken";

const optionalVerifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (!err && decoded?.UserInfo) {
      req.user = decoded.UserInfo.username;
    }
    next();
  });
};

export default optionalVerifyJWT;
