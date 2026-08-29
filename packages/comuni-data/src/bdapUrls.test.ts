import { describe, expect, it, vi } from "vitest";
import {
  resolveBdapDumpUrls,
  resolveBdapPatrimonioDumpUrl,
} from "./bdapUrls.js";

describe("resolveBdapDumpUrls", () => {
  it("picks latest regional entrate/spese datastore dump URLs", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("Entrate")) {
        return new Response(
          JSON.stringify({
            success: true,
            result: {
              results: [
                {
                  title: "2014 - Abruzzo - Gestione finanziaria Entrate Enti Locali",
                  id: "old-ent",
                  resources: [
                    {
                      format: "csv",
                      url: "http://bdap-opendata.rgs.mef.gov.it/SpodCkanApi/api/3/datastore/dump/old-ent.csv",
                    },
                  ],
                },
                {
                  title: "2015 - Abruzzo - Gestione finanziaria Entrate Enti Locali",
                  id: "new-ent",
                  resources: [
                    {
                      format: "csv",
                      url: "http://bdap-opendata.rgs.mef.gov.it/SpodCkanApi/api/3/datastore/dump/new-ent.csv",
                    },
                  ],
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          success: true,
          result: {
            results: [
              {
                title: "2015 - Abruzzo - Gestione finanziaria Spese Enti Locali",
                id: "new-spe",
                resources: [
                  {
                    format: "csv",
                    url: "http://bdap-opendata.rgs.mef.gov.it/SpodCkanApi/api/3/datastore/dump/new-spe.csv",
                  },
                ],
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const urls = await resolveBdapDumpUrls("Abruzzo", { fetchImpl });
    expect(urls?.entrateUrl).toContain("new-ent.csv");
    expect(urls?.speseUrl).toContain("new-spe.csv");
    expect(urls?.entrateUrl.startsWith("https://")).toBe(true);
  });
});

describe("resolveBdapPatrimonioDumpUrl", () => {
  it("picks latest national Conto del Patrimonio dump", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          success: true,
          result: {
            results: [
              {
                title:
                  "2014 - Gestione Patrimoniale Conto del Patrimonio Enti Locali",
                id: "old-pat",
                resources: [
                  {
                    format: "csv",
                    url: "http://bdap-opendata.rgs.mef.gov.it/SpodCkanApi/api/3/datastore/dump/old-pat.csv",
                  },
                ],
              },
              {
                title:
                  "2015 - Gestione Patrimoniale Conto del Patrimonio Enti Locali",
                id: "new-pat",
                resources: [
                  {
                    format: "csv",
                    url: "http://bdap-opendata.rgs.mef.gov.it/SpodCkanApi/api/3/datastore/dump/new-pat.csv",
                  },
                ],
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const urls = await resolveBdapPatrimonioDumpUrl({ fetchImpl });
    expect(urls?.year).toBe(2015);
    expect(urls?.patrimonioUrl).toContain("new-pat.csv");
    expect(urls?.patrimonioUrl.startsWith("https://")).toBe(true);
  });
});
