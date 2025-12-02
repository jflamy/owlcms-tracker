# Team Competition Scoreboard Plugin (NVF Preset)

This plugin implements a team competition scoreboard that groups athletes by team and shows current scores and predicted scores for team scoring.

This preset is configured with Norwegian defaults for NVF (Norwegian Weightlifting Federation) team league competitions. The display name and default options are configured in `config.js`.

## Rules for Gendered Team Competitions

Normal team competitions are gendered, separate men and women scores.

1. **Sessions contain athletes of a single gender.**
   - The scoreboard has 3 modes: M, F or MF. For gendered competitions, M or F is used, and the scoreboard will switch to the current gender of the current session.
2. **Any kg lifted scores points.**
   - If two teams have athletes bomb-out in snatch, then these athletes can score point in clean-and-jerk
   - Same for a bomb-out in clean-and-jerk, the kilos lifted in snatch score points.
3. **Scores are computed using the Sinclair 2024 coefficients, without age factors.**
   - The predicted score assumes the the next declared lift is successful.
4. **Team scores the sum of the scores for the best 4 athletes of the same gender**
   - Team members retained for scoring are highlighted
5. **Number of members in the team is not enforced by the scoreboard.**
   - The scoreboard will show them all.  owlcms can give warnings on team sizes, but this is expected to have been dealt with prior to the competition

## Rules for Mixed Team Competitions

Mixed competitions are selected by adding `gender=MF` on the URL

1. **"sub-sessions" are mapped directly to OWLCMS sessions.**
2. **"sub-sessions" include a single gender, to avoid barbell loading issues**
3. **In a mixed competition, the scoreboard is opened in "MF" mode, and will not change according to the gender of the current sub-session**
4. **Team scores are computed by adding best two men scores with best two women scores.**
   - highlights show which two of each gender have been selected

## URL and Options

- Options can be selected on the entry page
- Route: `/{plugin-name}?fop={FOP_NAME}&gender={M|F|MF|Current}&currentAttemptInfo={true|false}`
  - `fop` - Field of play / platform name (if multiple platforms)
  - `gender` - Filter by gender:
    - `M` - Show men only
    - `F` - Show women only
    - `MF` - Mixed mode with configurable top M + F calculation
    - `Current` - Follow the current session gender (default)
  - `currentAttemptInfo` - Display current lifter information at the top
