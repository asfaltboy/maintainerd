const { includes, chain } = require("lodash");


const SEPARATOR = exports.SEPARATOR = "<!-- maintainerd: DO NOT REMOVE -->";
const ENTRY_MARKER = "<!-- checklist item -->";
const ENTRY_MARKER_REQUIRED = "<!-- checklist item; required -->";
const SEMVER_MARKER = exports.SEMVER_MARKER = "<!-- semver -->";


const discreteInstances = (string, substring) => string.split(substring).length - 1;


exports.isPresent = body => includes(body, SEPARATOR);

exports.build = (body, config) => {
  const { pullRequest: { preamble, items, semver } } = config;

  const checklistEntries = items.map(item =>
    `- [${
      item.default ? "x" : " "
    }] ${
      item.required ? ENTRY_MARKER_REQUIRED : ENTRY_MARKER
    }${
      item.prompt
    }${
      item.required ? " _(required)_" : ""
    }`
  );

  let semverMessage = "";
  // TODO: If `semver.autodetect` is `true`, auto-fill the selection based on commit
  // message prefix of Fix/Bug, Add/Feature, Change/Breaking, Documentation.
  if (semver.enabled) {
    semverMessage = `
The maintainers of this repository require you to select the semantic version type that
the changes in this pull request represent.  Please select one of the following:
- [ ] ${SEMVER_MARKER} major
- [ ] ${SEMVER_MARKER} minor
- [ ] ${SEMVER_MARKER} patch
- [ ] ${SEMVER_MARKER} documentation only
`;
  }

  return `${body.split(SEPARATOR)[0].trim()}
${SEPARATOR}

-----

${preamble}
${checklistEntries.join("\n")}
${semverMessage}
`;
};

exports.checkEntries = body => {
  const autogenerated = body.split(SEPARATOR)[1];
  const incomplete = discreteInstances(autogenerated, `- [ ] ${ENTRY_MARKER_REQUIRED}`);

  return incomplete > 0 ?
    `${incomplete} checklist items remaining.` :
    null;
};

exports.checkSemver = (body, config) => {
  if (!config.semver.required) { return null; }

  const autogenerated = body.split(SEPARATOR)[1];
  const complete = discreteInstances(autogenerated, `- [x] ${SEMVER_MARKER}`);

  if (complete === 1) { return null; }
  if (complete === 0 ) { return "You must select a semantic version."; }

  return "You may only select a single semantic version.";
};

exports.getLogEntry = (oldBody, newBody, username) => {
  // If a checkbox was (un)checked, the length will be unchanged.
  if (oldBody.length !== newBody.length) { return null; }

  const oldLines = oldBody.split("\n");
  const newLines = newBody.split("\n");

  // If a checkbox was (un)checked, the number of lines will be unchanged.
  if (oldLines.length !== newLines.length) { return null; }

  return chain(oldLines)
    .map((oldLine, idx) => {
      const newLine = newLines[idx];
      if (oldLine === newLine) { return; }

      if (includes(oldLine, ENTRY_MARKER)) {
        const [ checkboxSegment, description ] = newLine.split(ENTRY_MARKER, 2);
        return `@${username} ${checkboxSegment === "- [ ] " ? "unchecked" : "checked"} \`${description.trim()}\`.`;
      }

      if (includes(oldLine, ENTRY_MARKER_REQUIRED)) {
        const [ checkboxSegment, description ] = newLine.split(ENTRY_MARKER_REQUIRED, 2);
        return `@${username} ${(checkboxSegment === "- [ ] ") ? "unchecked" : "checked"} \`${description.trim()}\`.`;
      }

      if (includes(oldLine, SEMVER_MARKER)) {
        const [ checkboxSegment, description ] = newLine.split(SEMVER_MARKER, 2);
        return `@${username} ${checkboxSegment === "- [ ] " ? "deselected" : "selected"} \`${description.trim()}\` as the semantic version.`;
      }
    })
    .find()
    .value();
};
