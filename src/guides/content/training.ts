/** Training & Certification chapter. Shown only while the module is switched on. */

import type { Gate } from "../gate";
import type { GuideSection, GuideStep } from "../types";

const STEPS: Partial<Record<Gate["audience"], { steps: GuideStep[]; rules?: string[] }>> = {
  faculty: {
    steps: [
      {
        title: "Request a demonstration",
        body: "Open Training & Demos, choose the department (only departments with demonstration equipment are listed; IIC by default) and the equipment, and request a demonstration for your class or group. The form shows the estimated charge.",
      },
      { title: "Nominate students", body: "When a training call is open, nominate your students for hands-on training before the deadline." },
    ],
    rules: [
      "Demonstrations are charged at the equipment's internal IITR rate and deducted from your wallet when the OIC approves, unless the OIC waives the charge (you see who waived it and why). Cancel early for a full or half refund; a rejected request costs nothing.",
    ],
  },
  student: {
    steps: [
      { title: "Follow your trainings", body: "Open My Trainings to see your applications, selection results and upcoming sessions." },
      { title: "Get certified", body: "After you attend, the lab can certify you; it shows as a Trained badge." },
    ],
  },
  oic: {
    steps: [
      {
        title: "Training workspace",
        body: "Open Training workspace to answer demonstration requests, open nomination calls, schedule sessions and award certifications.",
      },
    ],
    rules: [
      "Hands-on seats are allotted fairly among the nominated students.",
      "To waive a demonstration charge, tick Waive demonstration charge when deciding (or use Waive charge later) and give a reason; a charge already deducted is refunded in full.",
    ],
  },
  operator: {
    steps: [{ title: "Mark attendance", body: "Open Training attendance and mark who attended each session or demonstration on your equipment." }],
  },
  admin: {
    steps: [
      {
        title: "Enable Training",
        body: "In Admin Settings → Training Policy, switch the module on, choose Test accounts only or Everyone eligible, and turn Training on for each equipment.",
      },
      { title: "Training Policy", body: "Set the training rules on the same page, including whether course demonstrations are free." },
    ],
    rules: [
      "With Test accounts only, real faculty and students see no Training menus; Officers In Charge and Lab Operators of enabled equipment still see the Training workspace and attendance.",
    ],
  },
};

export function trainingSection(g: Gate): GuideSection | null {
  const role = STEPS[g.audience];
  if (!g.flags.training || !role) return null;
  return {
    id: "training",
    title: "Training & Certification",
    icon: "star",
    group: g.pick({ faculty: "Training", student: "Training", admin: "Administration" }, "Lab operations"),
    intro: ["Equipment demonstrations, hands-on training and Trained badges."],
    steps: role.steps,
    rules: role.rules,
  };
}
