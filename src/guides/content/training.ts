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
      "Selection is fair across faculty groups: students selected recently, or from a group that already had several seats in the same call, rank lower for a cooling period.",
    ],
  },
  student: {
    steps: [
      { title: "Follow your trainings", body: "Open My Trainings to see your applications, selection results and upcoming sessions." },
      {
        title: "Get certified",
        body: "After the sessions the OIC assesses you (theory score and a practical checklist). Open the certification in My Trainings → Certifications to download the PDF certificate or share its verification link.",
      },
      {
        title: "Operator duty",
        body: "With an operator-level certification you join the equipment's operator roster. When an OIC allocates you duty, confirm or decline from the email link or from My operator duty, check in when you start and check out when you finish.",
      },
    ],
    rules: [
      "Answer duty requests before the deadline shown; unanswered duty is released to the next operator. Declining with a reason does not count against you.",
      "Your hours are counted from check-in/out, from completed bookings during your shift, or from the OIC's record, and appear in your monthly statement.",
      "Certificates have a validity period; you get a reminder before expiry so you can recertify.",
    ],
  },
  oic: {
    steps: [
      {
        title: "Training workspace",
        body: "Open Training workspace to answer demonstration requests, open nomination calls, schedule sessions, record assessments and manage certifications.",
      },
      {
        title: "Assess and certify",
        body: "In Assessments, record the theory score and tick each practical checklist item; the result and grade are worked out for you. Edit the checklist per equipment. Operator-level certificates need a second sign-off.",
      },
      {
        title: "Allocate operator duty",
        body: "Open Operator duty → Allocate. Pick calendar slots, a date range or a weekly pattern, then choose from the fair-rotation list (it shows why each person is next). Optionally ask the operator to confirm by email or portal.",
      },
      {
        title: "Track hours live",
        body: "Live shows who is on duty now and shifts waiting for hours. Hours gives allocated, confirmed and operated hours by operator, equipment, department, faculty group or month, with CSV export and per-operator statements.",
      },
    ],
    rules: [
      "Hands-on seats are allotted fairly among the nominated students.",
      "To waive a demonstration charge, tick Waive demonstration charge when deciding (or use Waive charge later) and give a reason; a charge already deducted is refunded in full.",
      "Choosing someone other than the first in the rotation, or someone over the weekly/semester cap or inside the cooling period, needs a reason that is recorded with the allocation.",
      "Clashes with the operator's other duty or their own bookings cannot be overridden; maintenance and training clashes are shown as warnings.",
      "Suspending, revoking or renewing a certificate needs a reason and is kept in the certificate history.",
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
      {
        title: "Operator & fair-use rules",
        body: "On the same page set the selection cooling period, faculty-group repeat penalty, duty caps per week and semester, cooling days between duty blocks, confirmation deadline, rotation weights and the indicative honorarium rate. Department administrators can set rules for their department and OICs for their own equipment; the most specific rules apply.",
      },
    ],
    rules: [
      "With Test accounts only, real faculty and students see no Training menus; Officers In Charge and Lab Operators of enabled equipment still see the Training workspace and attendance.",
      "Every rules change is a new version; allocations and calls keep the version they were made under.",
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
    intro: ["Equipment demonstrations, hands-on training, assessments, verifiable certificates and fair operator duty with live hours."],
    steps: role.steps,
    rules: role.rules,
  };
}
