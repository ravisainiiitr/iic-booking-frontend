// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { CityPicker, CountryPicker, StatePicker, countryNames, districtsFor, isIndia } from "./AddressPickers";

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => {};

afterEach(() => cleanup());

describe("address data", () => {
  it("lists districts by state name and treats an empty country as India", () => {
    expect(districtsFor("Uttarakhand")).toContain("Haridwar");
    expect(districtsFor("Ladakh")).toEqual(["Kargil", "Leh"]);
    expect(districtsFor("Nowhere")).toEqual([]);
    expect(isIndia("")).toBe(true);
    expect(isIndia("Nepal")).toBe(false);
    expect(countryNames()).toContain("India");
  });
});

function Form() {
  const [a, setA] = useState({ country: "", state: "", city: "" });
  return (
    <div>
      <label htmlFor="c">Country</label>
      <label htmlFor="s">State</label>
      <label htmlFor="t">City</label>
      <CountryPicker id="c" value={a.country} onChange={(v) => setA((p) => ({ ...p, country: v }))} />
      <StatePicker id="s" value={a.state} country={a.country} onChange={(v) => setA((p) => ({ ...p, state: v }))} />
      <CityPicker id="t" value={a.city} country={a.country} state={a.state} onChange={(v) => setA((p) => ({ ...p, city: v }))} />
      <output data-testid="value">{JSON.stringify(a)}</output>
    </div>
  );
}

describe("pickers", () => {
  it("defaults to India, offers the state's districts and accepts a typed town", () => {
    render(<Form />);
    expect(screen.getByTestId("value").textContent).toContain('"country":"India"');
    fireEvent.click(screen.getByRole("combobox", { name: /state/i }));
    fireEvent.click(screen.getByRole("option", { name: "Uttarakhand" }));
    fireEvent.click(screen.getByRole("combobox", { name: /city/i }));
    expect(screen.getByRole("option", { name: "Haridwar" })).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(/search or type your city/i), { target: { value: "Roorkee" } });
    fireEvent.click(screen.getByRole("option", { name: "Use “Roorkee”" }));
    expect(screen.getByTestId("value").textContent).toBe('{"country":"India","state":"Uttarakhand","city":"Roorkee"}');
  });
});
