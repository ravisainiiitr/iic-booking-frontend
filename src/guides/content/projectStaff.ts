import type { RoleGuide } from "../gate";
import { bookerSections } from "./bookers";

export const projectStaffGuide: RoleGuide = {
  title: "Project staff guide",
  welcome: "Book equipment against your PI's wallet, track your samples and download results.",
  sections: bookerSections,
};
