# NVF Lagkonkurranse Plugin

This plugin implements the NVF (Norwegian Weightlifting Federation) team competition scoreboard used at team championships.  It provides a scoreboard that groups athletes by team and shows current scores and predicted scores for team scoring.

## Rules for Gendered Team Competitions

Normal team competitions are gendered, separate men and women scores.

1. **"NVF sub-sessions" are mapped to OWLCMS sessions.**
   - Example: `1.1` as a sub-session is a session in owlcms
   - owlcms round-robin order is used; this makes the athletes do all first lifts, all second lifts, all third lifts.
   - The speaker will switch manually from 1.1 to 1.2 and so on.
2. **Each OWLCMS session (NVF sub-session) contains athletes of a single gender.**
   - The scoreboard has 3 modes: M, F or MF.  For gendered competitions, M or F is used, and the scoreboard will switch to the current gender of the current sub-session.
3. **Any kg lifted scores points.**
   - If two teams have athletes bomb-out in snatch, then these athletes can score point in clean-and-jerk
   - Same for a bomb-out in clean-and-jerk, the kilos lifted in snatch score points.
4. **Scores are computed using the Sinclair 2024 coefficients, without age factors.**
   - The predicted score assumes the the next declared lift is successful.
5. **Team scores the sum of the scores for the best 4 athletes of the same gender**
   - Team members retained for scoring are highlighted
6. **Number of members in the team is not enforced by the scoreboard.**
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
- Route: `/nvf-lagkonkurranse?fop={FOP_NAME}&gender={M|F|MF}&currentAttempt={true|false}`
  - fop means field of play -- the platform name if multiple platforms
  - gender is normally not used except when forcing a gender
    - For example, if you want to display the Men score in a a broadcast during the women session, use gender=M
    - Using gender=MF forces Mixed mode with top 2 + 2 calculation.
  - currentAttempt
    - true means display the athlete at the top
