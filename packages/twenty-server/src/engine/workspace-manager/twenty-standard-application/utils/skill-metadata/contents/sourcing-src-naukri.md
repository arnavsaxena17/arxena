## Source: Naukri

Naukri is for recruiting, mid-level and plant-level roles above all. The surfaces are Resdex (candidate search) and Hiring. The user runs them from the Chrome extension, which uploads what it reads to the CRM as candidates tagged to the project. Rows then appear on the People tab with a source such as `resdex_naukri` or `hiring_naukri`.

- **Ask AI does not start a crawl.** There is no chat tool for it. Tell the user what to run: the Resdex page with your boolean title and company strings (`boolean-title-strings` style), and the filters you recommend. They run it with the extension connected, and the rows arrive on the tab.
- **Rows enter at the profile level.** They skip the search snapshot. Score them with `stage: "profile"`. Do not run `fetch_profiles` for a row that has no LinkedIn URL.
- **Age.** Naukri has a native age filter. Use it only when the user states a hard cap more than once. Otherwise ignore age.
- **Pace.** The extension reads a few profiles, then rests for about a minute. A big crawl takes a long time; say so rather than promise a time.
- **Contact details** are contact enrichment and not part of sourcing.
- **Coverage.** Whether Naukri covers a role better than LinkedIn is not known. Compare the two on a probe (`query-planning`) and report the measured share. Do not assert it.
