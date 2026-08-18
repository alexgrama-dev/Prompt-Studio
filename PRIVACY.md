# Privacy

Prompt Studio's Raycast Store release keeps Prompt Library and Frequent Prompts
local. Enhance Prompt contacts a model provider only after you submit an
enhancement and provide a key for that run.

## Data it handles

- Prompts are stored as readable Markdown files in the folder you choose.
- The extension reads and writes those prompt files when you browse, create,
  edit, duplicate, archive, restore, or delete a prompt.
- Paste and copy actions use Raycast's clipboard and paste APIs.
- Usage ranking is stored in a rebuildable local cache file. The Store release
  uses JSON; advanced source builds may use SQLite.

JSON is readable structured text. SQLite is a local database file. "Rebuildable"
means either cache can be deleted and re-created without losing the Markdown
prompts themselves.

## Network access

Prompt Library and Frequent Prompts do not send prompts, clipboard contents,
usage history, or prompt files to Prompt Studio servers or third-party
services.

Enhance Prompt sends the reviewed task to the provider you choose only after
you choose Enhance and enter a key for that attempt. Opening Enhance Prompt,
typing rough thoughts, or reviewing a result does not look up a saved key or
make a model request. The one-run key is used in the provider authentication
header and is not written into prompt files.

Prompt Studio does not include advertising, external analytics, or tracking.

Raycast itself is a separate product with its own privacy practices.

## Source-tree features that stay Disabled

The repository contains experimental research, project-context, command-line,
and local agent features that are not Store commands. Those features stay
Disabled on a Store installation and require an explicit later activation
before any additional external request.

## Removing local data

Delete the configured prompt folder to remove prompt files. Local indexes and
feature state live under Raycast's extension support directory and can be
removed by uninstalling the extension or clearing its data in Raycast.
