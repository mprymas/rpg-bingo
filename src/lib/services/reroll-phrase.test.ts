import { describe, expect, it } from "vitest";
import { pickCatalogPhrase, RerollPhraseError } from "@/lib/services/reroll-phrase";

const CATALOG = ["Oswój zwierzę", "Wespnij się na wysoki mur", "Trafienie krytyczne"];

describe("pickCatalogPhrase", () => {
  it("excludes every visible normalized form and returns exact catalog text", () => {
    const phrase = pickCatalogPhrase({
      catalog: CATALOG,
      visiblePhrases: ["  OSWÓJ   zwierzę ", "wespnij się na wysoki mur"],
      random: () => 0,
    });

    expect(phrase).toBe("Trafienie krytyczne");
  });

  it("can return a catalog phrase the draft removed from a cell", () => {
    const phrase = pickCatalogPhrase({
      catalog: CATALOG,
      visiblePhrases: ["Wespnij się na wysoki mur", "Trafienie krytyczne"],
      random: () => 0,
    });

    expect(phrase).toBe("Oswój zwierzę");
  });

  it("never returns a custom phrase that is only visible, not in the catalog", () => {
    for (let step = 0; step < 20; step++) {
      const phrase = pickCatalogPhrase({
        catalog: CATALOG,
        visiblePhrases: ["Oswój zwierzę", "Smok zjadł konia", "Wespnij się na wysoki mur"],
        random: () => step / 20,
      });
      expect(phrase).toBe("Trafienie krytyczne");
      expect(phrase).not.toBe("Smok zjadł konia");
    }
  });

  it("throws POOL_EMPTY when every catalog form is already visible", () => {
    expect(() =>
      pickCatalogPhrase({
        catalog: ["Oswój zwierzę"],
        visiblePhrases: ["oswój zwierzę"],
        random: () => 0,
      }),
    ).toThrow(RerollPhraseError);

    try {
      pickCatalogPhrase({
        catalog: ["Oswój zwierzę"],
        visiblePhrases: ["oswój zwierzę"],
        random: () => 0,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(RerollPhraseError);
      expect((error as RerollPhraseError).code).toBe("POOL_EMPTY");
    }
  });

  it("throws POOL_EMPTY when the catalog is empty", () => {
    expect(() => pickCatalogPhrase({ catalog: [], visiblePhrases: [], random: () => 0 })).toThrow(
      expect.objectContaining({ code: "POOL_EMPTY" }),
    );
  });

  it("counts catalog rows that normalize to the same string once", () => {
    const onlyDuplicate = pickCatalogPhrase({
      catalog: ["Oswój zwierzę", "oswój   zwierzę"],
      visiblePhrases: ["Wespnij się na wysoki mur"],
      random: () => 0.99,
    });
    expect(onlyDuplicate).toBe("Oswój zwierzę");

    const secondForm = pickCatalogPhrase({
      catalog: ["Oswój zwierzę", "oswój zwierzę", "Wespnij się na wysoki mur"],
      visiblePhrases: [],
      random: () => 0.99,
    });
    expect(secondForm).toBe("Wespnij się na wysoki mur");
  });

  it("is deterministic for an injected random", () => {
    const catalog = ["A", "B", "C"];
    expect(pickCatalogPhrase({ catalog, visiblePhrases: [], random: () => 0 })).toBe("A");
    expect(pickCatalogPhrase({ catalog, visiblePhrases: [], random: () => 0.34 })).toBe("B");
    expect(pickCatalogPhrase({ catalog, visiblePhrases: [], random: () => 0.67 })).toBe("C");
  });
});
