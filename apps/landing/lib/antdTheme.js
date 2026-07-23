// Shared Ant Design theme so AntD components inherit the mAutomate tokens.
export const antdTheme = {
  token: {
    colorPrimary: "#F15A29",
    colorInfo: "#F15A29",
    fontFamily:
      "Gilroy, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    borderRadius: 12,
    colorTextBase: "#141414",
  },
  components: {
    Collapse: {
      headerBg: "transparent",
      contentBg: "transparent",
      headerPadding: "20px 4px",
      contentPadding: "0 4px 20px",
    },
  },
};
