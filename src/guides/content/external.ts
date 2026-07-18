import {
  type UserGuideContent,
  bookingStatusSection,
  notificationsSection,
  supportSection,
  bestPracticesSection,
} from "../types";

export const externalGuide: UserGuideContent = {
  audience: "external",
  audienceLabel: "External Users",
  title: "External User Guide",
  subtitle: "Educational institutes, R&D labs, industry, and other external organisations",
  welcomeHeadline: "Welcome to the IIC Online Equipment Booking System",
  welcomeBody:
    "This portal lets your organisation book Institute Instrumentation Centre (IIC) equipment at IIT Roorkee, track samples and results, and manage payments. This short guide explains what you can access and how to complete your first booking.",
  sections: [
    {
      id: "welcome",
      title: "Welcome",
      paragraphs: [
        "The Online Equipment Booking System is the official channel for reserving analytical and specialised instruments at IIC, IIT Roorkee.",
        "Through this portal you can browse equipment, estimate charges, request slots, submit samples as instructed by the lab, pay invoices, and raise support tickets.",
      ],
      bullets: [
        "Browse published equipment and laboratory details",
        "Create and track bookings online",
        "Pay via the online payment workflow where applicable",
        "Receive email and in-app updates for every major milestone",
      ],
    },
    {
      id: "access",
      title: "What You Can Access",
      paragraphs: [
        "As an external user (educational institute, government R&D, industry, or other approved category), you book as a guest organisation under external pricing and booking windows.",
      ],
      bullets: [
        "Access to equipment that is published for external booking (subject to lab rules and capacity).",
        "External charge profiles typically include applicable taxes/GST as configured for your category.",
        "Booking windows and reserved internal slots may limit when you can book compared with campus users.",
        "Before first booking, confirm I-STEM portal registration when the system requests it.",
        "You do not use internal department grant wallets; payments follow the external / online path.",
      ],
      callouts: [
        "Your exact rates depend on user category (Educational Institute, R&D, Industry, etc.). Always check View and Calculate Charges on the equipment page.",
      ],
    },
    {
      id: "profile",
      title: "Registration & Profile",
      paragraphs: [
        "Complete your profile soon after registration so bookings and invoices show the correct organisation details.",
      ],
      bullets: [
        "Verify email and wait for admin approval if your account requires it before booking.",
        "Update name, phone, and organisation/department details under Profile.",
        "Upload or complete any KYC / documentary checks requested during onboarding or revalidation.",
        "Keep billing and GST-related details accurate when prompted for external billing.",
        "Acknowledge I-STEM registration when required — booking is blocked until this is confirmed.",
      ],
    },
    {
      id: "booking",
      title: "Booking Workflow",
      paragraphs: [
        "Booking is designed as a guided flow from discovery to confirmation.",
      ],
      bullets: [
        "Search or browse Equipments; open View Details & Charges for specifications, accessories, and OIC information.",
        "Use View and Calculate Charges to understand pricing for your user category and run parameters.",
        "Check the availability calendar for free slots within the allowed booking window.",
        "Create a booking with the required slot(s), sample count, and accessories if offered.",
        "Complete payment when the booking enters Awaiting payment (if required for your flow).",
        "Confirmation appears as Booked — you will also receive email confirmation when configured.",
      ],
    },
    {
      id: "samples",
      title: "Sample Submission Process",
      paragraphs: [
        "Many instruments require physical sample submission before the scheduled run. Deadlines are enforced so the lab can prepare.",
      ],
      bullets: [
        "Note the sample submission deadline shown on your booking (often tied to slot start and lab lead time).",
        "Watch countdown reminders on the dashboard and by email before the deadline.",
        "Follow the lab’s acceptance workflow — samples may be marked accepted/rejected by staff.",
        "If atmosphere-sensitive sample handling is offered for that equipment, select it only when your sample truly requires it.",
        "After the run, follow lab instructions for result collection or download when files are published.",
      ],
    },
    {
      id: "payments",
      title: "Payments & Charges",
      paragraphs: [
        "External bookings use external charge rates and online or invoice-linked payment workflows rather than internal grant wallets.",
      ],
      bullets: [
        "Charges are estimated before booking and confirmed according to actual usage rules published by the lab.",
        "Pay online when the portal directs you to the payment step for your booking.",
        "Download or retain proforma invoices / receipts from the booking or payment screens when available.",
        "Unresolved Awaiting payment states may release the slot if payment is not completed in time.",
      ],
    },
    bookingStatusSection(),
    notificationsSection([
      "Payment and invoice emails are especially important for external organisations — monitor the mailbox used at registration.",
    ]),
    supportSection(),
    {
      id: "faq",
      title: "Frequently Asked Questions",
      paragraphs: ["Common questions for external organisations:"],
      bullets: [
        "Why can’t I book yet? — Email verification, admin approval, or I-STEM acknowledgement may still be pending.",
        "Why are some slots blocked? — Internal reserved capacity or external booking windows may apply.",
        "How do I know my rate? — Use Calculate Charges with your user category, or contact support with the equipment code.",
        "Who do I contact for a scientific method question? — Raise a ticket from the equipment page so the lab OIC can respond.",
        "Can I cancel? — Use My Bookings cancellation/request flows subject to lab and payment policy.",
      ],
    },
    bestPracticesSection([
      "Align purchase-order or finance cycles with booking dates so payment does not delay confirmation.",
    ]),
  ],
};
