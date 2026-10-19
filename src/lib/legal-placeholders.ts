/**
 * Public privacy and terms pages replace these tokens wherever they still
 * appear, including copy saved in the database. The admin editor still
 * shows the tokens.
 */
export const LEGAL_PLACEHOLDERS = {
  mailingAddress: "Cornhole Media, 1609 N Riverfront Dr, Suite 200, Mankato, MN 56001",
  governingState: "Minnesota",
  designatedAgentName: "Cornhole Media",
} as const;

const TOKEN_VALUES: Record<string, string> = {
  "[MAILING ADDRESS]": LEGAL_PLACEHOLDERS.mailingAddress,
  "[STATE]": LEGAL_PLACEHOLDERS.governingState,
  "[DESIGNATED AGENT NAME]": LEGAL_PLACEHOLDERS.designatedAgentName,
};

export function applyLegalPlaceholders(text: string): string {
  let next = text;
  for (const [token, value] of Object.entries(TOKEN_VALUES)) {
    if (!value || value === token) continue;
    next = next.replaceAll(token, value);
  }
  return next;
}
