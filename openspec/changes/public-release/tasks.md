## 1. Public release surface

- [x] 1.1 Define a Store manifest containing only Prompt Studio and Most-Used Prompts
- [x] 1.2 Limit Store preferences to the local prompt directory
- [x] 1.3 Remove the machine-specific SSH default from the development manifest
- [x] 1.4 Update fresh-library language so it does not promise disabled enhancement

## 2. Safe Store package

- [x] 2.1 Add an ignored `dist-store/` preparation flow based on a fixed public file list
- [x] 2.2 Assert exact Store commands, preferences, and top-level files
- [x] 2.3 Generate and commit the npm dependency lock on the Mac mini
- [x] 2.4 Pass Store lint and build from the generated package on the Mac mini
- [x] 2.5 Replace unsupported `node:sqlite` loading with a tested Store usage cache

## 3. Public project material

- [x] 3.1 Add the MIT license, changelog, privacy policy, security policy, and contribution guide
- [x] 3.2 Replace the internal README with a user-first product and development guide
- [x] 3.3 Add reviewed public screenshots with synthetic prompt content
- [x] 3.4 Add structured bug, feature, and pull request templates
- [x] 3.5 Enable GitHub private vulnerability reporting

## 4. Verification and publication

- [x] 4.1 Pass strict OpenSpec validation
- [x] 4.2 Pass the complete repository check on the Mac mini
- [x] 4.3 Scan the repository and generated Store package for secrets and private paths
- [x] 4.4 Review the exact public Git diff and Store file list
- [x] 4.5 Publish the repository release
- [ ] 4.6 Submit the Raycast Store pull request
- [ ] 4.7 Load the exact Store distribution in Raycast without a runtime error
