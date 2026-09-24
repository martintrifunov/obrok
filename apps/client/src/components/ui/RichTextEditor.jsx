import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import {
  Box,
  styled,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatUnderlinedIcon from "@mui/icons-material/FormatUnderlined";
import StrikethroughSIcon from "@mui/icons-material/StrikethroughS";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import LinkIcon from "@mui/icons-material/Link";
import FormatClearIcon from "@mui/icons-material/FormatClear";

const RichTextEditor = ({ value, onChange, error }) => {
  const editor = useEditor({
    extensions: [StarterKit, Underline, Link.configure({ openOnClick: false })],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML() === "<p></p>" ? "" : editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && value && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  if (!editor) return null;

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      window.alert("Only http:// and https:// links are allowed.");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <EditorContainer $isError={!!error}>
      <Toolbar>
        <ToggleButtonGroup size="small" aria-label="text formatting">
          <ToggleButton
            value="bold"
            selected={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <FormatBoldIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton
            value="italic"
            selected={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <FormatItalicIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton
            value="underline"
            selected={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <FormatUnderlinedIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton
            value="strike"
            selected={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <StrikethroughSIcon fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>

        <ToggleButtonGroup size="small" aria-label="block formatting">
          <ToggleButton
            value="bullet"
            selected={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <FormatListBulletedIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton
            value="ordered"
            selected={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <FormatListNumberedIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton
            value="blockquote"
            selected={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <FormatQuoteIcon fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>

        <ToggleButtonGroup size="small">
          <ToggleButton
            value="link"
            selected={editor.isActive("link")}
            onClick={setLink}
          >
            <LinkIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton
            value="clear"
            onClick={() =>
              editor.chain().focus().clearNodes().unsetAllMarks().run()
            }
          >
            <FormatClearIcon fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>
      </Toolbar>
      <EditorContent editor={editor} />
    </EditorContainer>
  );
};

const EditorContainer = styled(Box)(({ theme, $isError }) => ({
  width: "100%",
  display: "flex",
  flexDirection: "column",
  border: `1px solid ${$isError ? theme.palette.error.main : theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  overflow: "hidden",
  transition: "border-color 0.2s ease-in-out",
  "&:hover": {
    borderColor: $isError
      ? theme.palette.error.main
      : theme.palette.text.primary,
  },
  "&:focus-within": {
    borderColor: $isError
      ? theme.palette.error.main
      : theme.palette.primary.main,
  },
  "& .ProseMirror": {
    backgroundColor:
      theme.palette.mode === "dark"
        ? theme.palette.background.default
        : "transparent",
    padding: theme.spacing(2),
    minHeight: "200px",
    maxHeight: "350px",
    overflowY: "auto",
    outline: "none",
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.body1.fontSize,
    "& p": { marginTop: 0, marginBottom: "0.5em" },
    "& ul, & ol": { marginTop: 0, marginBottom: "0.5em", paddingLeft: "1.5em" },
    "& blockquote": {
      borderLeft: `4px solid ${theme.palette.divider}`,
      paddingLeft: "1em",
      marginLeft: 0,
      fontStyle: "italic",
    },
  },
}));

const Toolbar = styled(Box)(({ theme }) => ({
  borderBottom: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(0.5),
  display: "flex",
  gap: theme.spacing(0.5),
  flexWrap: "wrap",
  backgroundColor:
    theme.palette.mode === "dark"
      ? theme.palette.background.default
      : theme.palette.grey[100],
}));

export default RichTextEditor;
