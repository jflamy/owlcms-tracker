# Team Competition Scoreboard Plugin

This plugin implements a team competition scoreboard that groups athletes by team and shows current scores and predicted scores for team scoring.

The display name and default options are configured in `config.js`.

## Rules for Gendered Team Competitions

Normal team competitions are gendered, with separate men and women scores.

1. **Sessions contain athletes of a single gender.**
   - The scoreboard has 3 modes: M, F or MF. For gendered competitions, M or F is used, and the scoreboard will switch to the current gender of the current session.
2. **Any kg lifted scores points.**
   - If an athlete bombs out in snatch, they can still score points in clean-and-jerk.
   - Same for a bomb-out in clean-and-jerk - the kilos lifted in snatch score points.
3. **Scores are computed using the Sinclair 2024 coefficients, without age factors.**
   - The predicted score assumes the next declared lift is successful.
4. **Team scores are the sum of the scores for the top athletes of the same gender**
   - Team members contributing to the score are highlighted.
   - The number of top athletes counted is configurable.
5. **Number of members in the team is not enforced by the scoreboard.**
   - The scoreboard will show all athletes. OWLCMS can give warnings on team sizes.

## Rules for Mixed Team Competitions

Mixed competitions are selected by adding `gender=MF` on the URL

1. **Sessions include a single gender, to avoid barbell loading issues**
2. **In a mixed competition, the scoreboard is opened in "MF" mode, and will not change according to the gender of the current session**
3. **Team scores are computed by adding the best men's scores with the best women's scores.**
   - Highlights show which athletes of each gender have been selected.
   - The number of top athletes per gender is configurable.

## URL and Options

- Options can be selected on the entry page
- Route: `/team-scoreboard?fop={FOP_NAME}&gender={M|F|MF|Current}&currentAttemptInfo={true|false}`
  - `fop` - Field of play / platform name (if multiple platforms)
  - `gender` - Filter by gender:
    - `M` - Show men only
    - `F` - Show women only
    - `MF` - Mixed mode with configurable top M + F calculation
    - `Current` - Follow the current session gender (default)
  - `currentAttemptInfo` - Display current lifter information at the top
