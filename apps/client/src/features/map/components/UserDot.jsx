import { Box, styled } from "@mui/material";

const DotContainer = styled(Box)({
  width: 20,
  height: 20,
  borderRadius: "50%",
  backgroundColor: "#4285F4",
  border: "3px solid white",
  boxShadow: "0 0 10px rgba(0,0,0,0.3)",
  transition: "transform 1s linear",
});

const UserDot = () => <DotContainer />;

export default UserDot;
