// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchContacts } from "./SearchContacts";

describe("SearchContacts", () => {
  afterEach(cleanup);

  it("lists each role with name, designation, email and phone links", () => {
    render(
      <SearchContacts
        contacts={{
          lab_operators: [{ name: "Op Kumar", designation: "Technical Officer", email: "op@iitr.ac.in", phone: "9876500011" }],
          oics: [{ name: "Prof. Oic", designation: "Officer In Charge", email: "oic@iitr.ac.in", phone: "" }],
          accounts_in_charge: [],
        }}
      />
    );
    const list = screen.getByTestId("search-contacts");
    expect(within(list).getByText("Op Kumar")).toBeTruthy();
    expect(within(list).getByText("(Technical Officer)")).toBeTruthy();
    expect(within(list).getByRole("link", { name: /op@iitr.ac.in/ }).getAttribute("href")).toBe("mailto:op@iitr.ac.in");
    expect(within(list).getByRole("link", { name: /9876500011/ }).getAttribute("href")).toBe("tel:9876500011");
    expect(within(list).queryByRole("link", { name: /^$/ })).toBeNull();
    expect(within(list).getByText("Not listed")).toBeTruthy(); // no Accounts In Charge
  });

  it("does not open the surrounding result when a contact link is clicked", () => {
    const openRow = vi.fn();
    render(
      <div onClick={openRow}>
        <SearchContacts
          contacts={{ lab_operators: [{ name: "Op", designation: "Lab Operator", email: "op@iitr.ac.in", phone: "" }], oics: [], accounts_in_charge: [] }}
        />
      </div>
    );
    fireEvent.click(screen.getByRole("link", { name: /op@iitr.ac.in/ }));
    expect(openRow).not.toHaveBeenCalled();
  });

  it("renders nothing without contacts", () => {
    const { container } = render(<SearchContacts contacts={null} />);
    expect(container.innerHTML).toBe("");
  });
});
