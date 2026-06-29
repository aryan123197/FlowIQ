module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // new feature
        'fix', // bug fix
        'docs', // documentation
        'style', // formatting, no logic change
        'refactor', // code restructure
        'test', // tests
        'chore', // build, deps, config
        'perf', // performance improvement
        'ci', // CI/CD changes
        'revert', // revert a commit
      ],
    ],
    'subject-case': [2, 'always', 'lower-case'],
    'header-max-length': [2, 'always', 100],
  },
}
