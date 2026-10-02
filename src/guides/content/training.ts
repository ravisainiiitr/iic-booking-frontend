/** Training & Certification chapter. Shown only while the module is switched on. */

import type { Gate } from "../gate";
import type { GuideSection, GuideStep } from "../types";

const STEPS: Partial<Record<Gate["audience"], { steps: GuideStep[]; rules?: string[] }>> = {
  faculty: {
    steps: [
      { title: "Request a demonstration", body: "Open Training & Demos and request a demonstration of an equipment for your class or group." },
      { title: "Nominate students", body: "When a training call is open, nominate your students for hands-on training before the deadline." },
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
    rules: ["Hands-on seats are allotted fairly among the nominated students."],
  },
  operator: {
    steps: [{ title: "Mark attendance", body: "Open Training attendance and mark who attended each session or demonstration on your equipment." }],
  },
  admin: {
    steps: [{ title: "Training Policy", body: "Set the training rules in Admin Settings → Training Policy." }],
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
