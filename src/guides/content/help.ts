import { BOOKERS, compact, type Gate } from "../gate";
import type { GuideFaq, GuideSection } from "../types";

export function helpSection(g: Gate, opts: { faqs: GuideFaq[]; tips?: string[] }): GuideSection {
  const booker = g.is(...BOOKERS);
  return {
    id: "help",
    title: "Help and FAQ",
    icon: "help",
    group: "Help",
    intro: compact([
      booker
        ? "Raise a ticket from Support Tickets in the user menu, or Raise Support Request on an equipment page. Include the booking ID."
        : "Raise a ticket from Support Tickets in the user menu if something does not work as described.",
      g.when(booker, "Lab Operator and Officer In Charge contacts are on each equipment page."),
    ]),
    tips: compact([
      ...(opts.tips ?? []),
      g.when(
        g.is("dept_admin", "admin", "finance", "external_relations"),
        "If My Profile has no valid 10-digit mobile number, a short Complete your profile prompt asks for it after you sign in; Remind me later asks again at your next sign-in.",
      ),
      "Menus work with the keyboard: press Tab to reach a menu and Enter to open it.",
      "Reopen this guide any time from User Guide in the user menu.",
    ]),
    faqs: opts.faqs,
  };
}
