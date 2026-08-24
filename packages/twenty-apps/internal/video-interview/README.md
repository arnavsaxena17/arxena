# Video Interview

Optional Arxena Twenty app for async video-interview CRM objects, recruiter UI, and command-menu actions.

**Not pre-installed.** New workspaces do not get these objects until the app is installed. Install later via the apps marketplace / `yarn twenty apply`.

Object/field/view universal identifiers are frozen to the values previously hashed under Arxena Standard (`a8e8a8e8-64aa-4b6f-b003-9c74b97cee21`) so install recreates the same GraphQL names (`videoInterviews`, etc.).

App UID: `c4e91b2a-7d3f-4a18-b5e6-9f0c1d2e3a47`

## Host leftovers (this phase)

- Nest upload / Whisper
- arxena-site avatar generation
- Candidate capture (`MediaRecorder` / webcam) in `twenty-front`
- arx-chat WhatsApp/email invite flow + candidate `startVideoInterviewChat*` fields (stay on Arxena Standard)

```bash
yarn twenty remote:add --api-url http://localhost:3000 --as local
yarn twenty apply
```
