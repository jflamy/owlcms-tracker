# NVF Lagkonkurranse Plugin

This plugin implements the NVF (Norwegian Weightlifting Federation) team competition scoreboard used at team championships.

## Purpose

Provide a server-side processed scoreboard that groups athletes by team and shows retained totals and predicted retained totals for team scoring.

## Rules for Gendered Team Competitions

Normal team competitions are gendered, separate men and women scores.

1. **"sub-sessions" are mapped directly to OWLCMS sessions.**
   - Example: `1.1` as a subsession will be a session in owlcms
   - owlcms round-robin order is used; this makes the athletes do all first lifts, all second lifts, all third lifts.
   - The speaker will switch manually from 1.1 to 1.2
2. **Each sub-session OWLCMS session contains athletes of a single gender.**
   - The scoreboard has 3 modes: M, F or MF.  For gendered competitions, M or F is used, and the scoreboard will switch to the current gender of the current sub-session.
3. **Scores are computed using the Sinclair 2024 coefficients, without age factors.**
   - The predicted score assumes the the next declared lift is successful.
4. **Team scores the sum of the scores for the best 4 athletes of the same gender**
   - Team members retained for scoring are highlighted
5. **Number of members in the team is not enforced by the scoreboard.**
   - The scoreboard will show them all.  owlcms can give warnings on team sizes, but this is expected to have been dealt with prior to the competition

## Rules for Mixed Team Competitions

(this has not been extensively tested)

1. **"sub-sessions" are mapped directly to OWLCMS sessions.**
2. **"sub-sessions" include a single gender, to avoid barbell loading issues**
3. **In a mixed competition, the scoreboard is opened in "MF" mode, and will not change according to the gender of the current sub-session**
4. **Team scores are computed by adding best two men scores with best two women scores.**
   - highlights show which two of each gender have been selected

## URL / options

- Route: `/nvf-lagkonkurranse?fop={FOP_NAME}&gender={M|F|MF}` (FOP means field of play)
- A right-click in the top area of the screen allows changing, but as explained above in a gendered competition the scoreboard will track the current group.
