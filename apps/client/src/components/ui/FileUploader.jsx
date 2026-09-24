import { useRef, useState } from "react";
import { IconButton, Box, useTheme, Typography } from "@mui/material";
import AttachmentIcon from "@mui/icons-material/Attachment";
import DeleteIcon from "@mui/icons-material/Delete";

const FileUploader = ({ accept, onSelectFile, onDeleteFile, disabled }) => {
  const hiddenFileInput = useRef(null);
  const [file, setFile] = useState(null);
  const theme = useTheme();

  const handleClick = () => {
    if (hiddenFileInput.current) {
      hiddenFileInput.current.click();
    }
  };

  const handleChange = (event) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      onSelectFile(event);
    }
  };

  const onDeleteFileHandler = () => {
    setFile(null);
    if (hiddenFileInput.current) {
      hiddenFileInput.current.value = "";
    }
    onDeleteFile();
  };

  const isDark = theme.palette.mode === "dark";

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        height: 56,
        border: `1px solid ${
          disabled
            ? theme.palette.action.disabledBackground
            : isDark
              ? "rgba(255, 255, 255, 0.23)"
              : "rgba(0, 0, 0, 0.23)"
        }`,
        borderRadius: `8px`,
        padding: "0 14px",
        backgroundColor: disabled
          ? theme.palette.action.hover
          : isDark
            ? "#0B1121"
            : "#ffffff",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "border-color 0.2s",
        "&:hover": {
          borderColor: disabled
            ? theme.palette.action.disabledBackground
            : isDark
              ? "rgba(255, 255, 255, 0.87)"
              : "rgba(0, 0, 0, 0.87)",
        },
      }}
      onClick={disabled ? undefined : handleClick}
    >
      <Box sx={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
        <AttachmentIcon
          sx={{
            marginRight: 1,
            color: disabled
              ? theme.palette.text.disabled
              : theme.palette.action.active,
          }}
        />
        <Typography
          sx={{
            color: file
              ? disabled
                ? theme.palette.text.disabled
                : theme.palette.text.primary
              : theme.palette.text.secondary,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            width: "100%",
            textAlign: "left",
          }}
        >
          {file ? file.name : "Choose file"}
        </Typography>
        <input
          type="file"
          accept={accept}
          ref={hiddenFileInput}
          onChange={handleChange}
          style={{ display: "none" }}
          disabled={disabled}
        />
      </Box>
      <IconButton
        aria-label="delete"
        disabled={disabled || !file}
        sx={{
          color: theme.palette.action.active,
          marginLeft: 1,
        }}
        onClick={(e) => {
          e.stopPropagation();
          onDeleteFileHandler();
        }}
        size="small"
      >
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  );
};

export default FileUploader;
