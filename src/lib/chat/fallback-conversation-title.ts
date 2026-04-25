const MAX_TITLE_LENGTH = 200;

export const fallbackConversationTitle = (plainText: string): string => {
  const firstLine = plainText
    .split(/\r?\n/)
    .find((line) => line.trim().length > 0);
  const base = (firstLine ?? plainText).trim();
  if (base.length === 0) {
    return "New conversation";
  }

  if (base.length <= MAX_TITLE_LENGTH) {
    return base;
  }

  return `${base.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…`;
};
