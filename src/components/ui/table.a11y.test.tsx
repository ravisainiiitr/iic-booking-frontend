// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { useState } from "react";
import { axeViolations } from "@/test/axe";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

function Transactions({ stackOnMobile = true }: { stackOnMobile?: boolean }) {
  const [rows, setRows] = useState([{ id: "T1", amount: "₹500" }]);
  return (
    <>
      <button type="button" onClick={() => setRows((r) => [...r, { id: "T2", amount: "₹250" }])}>
        Add row
      </button>
      <Table stackOnMobile={stackOnMobile}>
        <TableHeader>
          <TableRow>
            <TableHead>Reference</TableHead>
            <TableHead>Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.id}</TableCell>
              <TableCell>{row.amount}</TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell colSpan={2}>End of list</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </>
  );
}

describe("Table stackOnMobile", () => {
  afterEach(cleanup);

  it("labels each cell with its column heading and keeps table roles", () => {
    render(<Transactions />);
    expect(screen.getByText("T1").getAttribute("data-label")).toBe("Reference");
    expect(screen.getByText("₹500").getAttribute("data-label")).toBe("Amount");
    expect(screen.getByText("End of list").getAttribute("data-label")).toBe("");
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getAllByRole("columnheader").map((th) => th.textContent)).toEqual(["S.No.", "Reference", "Amount"]);
    expect(screen.getByText("1").getAttribute("data-label")).toBe("S.No.");
  });

  it("labels rows added after the first render", async () => {
    render(<Transactions />);
    await act(async () => screen.getByRole("button", { name: "Add row" }).click());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(screen.getByText("₹250").getAttribute("data-label")).toBe("Amount");
  });

  it("leaves tables without the prop untouched", () => {
    const { container } = render(<Transactions stackOnMobile={false} />);
    expect(screen.getByText("T1").hasAttribute("data-label")).toBe(false);
    expect(container.querySelector(".table-stack-mobile")).toBeNull();
  });

  it("has no axe violations", async () => {
    const { container } = render(<Transactions />);
    expect(await axeViolations(container)).toEqual([]);
  });
});

function serialColumn(container: HTMLElement) {
  return Array.from(container.querySelectorAll("tbody tr"), (tr) => tr.querySelector("[data-serial]")?.textContent ?? null);
}

describe("Table serial column", () => {
  afterEach(cleanup);

  it("numbers data rows in display order and leaves spanning rows blank", async () => {
    const { container } = render(<Transactions stackOnMobile={false} />);
    expect(serialColumn(container)).toEqual(["1", ""]);
    await act(async () => screen.getByRole("button", { name: "Add row" }).click());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(serialColumn(container)).toEqual(["1", "2", ""]);
  });

  it("continues from serialStart, can follow a checkbox column, and can be turned off", () => {
    const rows = (props: Record<string, unknown>) => (
      <Table {...props}>
        <TableHeader>
          <TableRow>
            <TableHead>Select</TableHead>
            <TableHead>Reference</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {["A", "B"].map((id) => (
            <TableRow key={id}>
              <TableCell>[ ]</TableCell>
              <TableCell>{id}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
    const { container, rerender } = render(rows({ serialStart: 26, serialAfterFirstColumn: true }));
    expect(screen.getAllByRole("columnheader").map((th) => th.textContent)).toEqual(["Select", "S.No.", "Reference"]);
    expect(serialColumn(container)).toEqual(["26", "27"]);
    rerender(rows({ serial: false }));
    expect(screen.getAllByRole("columnheader").map((th) => th.textContent)).toEqual(["Select", "Reference"]);
    expect(container.querySelector("[data-serial]")).toBeNull();
  });
});
