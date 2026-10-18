<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep microphone lifecycle in the shared useRecognition hook so all speaking inputs use the same cancellation, permission errors, and transcript handling.
- Read and write app data and auth only through the generated Cloud client at `@/integrations/supabase/client`, and read backend addresses from environment variables inside handlers — never hand-roll a client or hardcode a backend URL or key, because the backend is provisioned per project and its address can change.
