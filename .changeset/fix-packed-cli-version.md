---
'@link-assistant/image-to-number': patch
---

Fix CLI entry-point detection through npm bin symlinks and print the installed
package version without loading network dependencies. Verify the packed tarball
in CI and the publish preflight.
