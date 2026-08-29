import { describe, expect, it, vi } from "vitest";
import { resolveBdapDumpUrls } from "./bdapUrls.js";

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
