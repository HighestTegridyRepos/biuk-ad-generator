# Mindstate Personas - Quick Reference Guide

## What is Mindstate Marketing?

A behavioral science framework that combines:
- **APPROACH** (how people decide): Cautious (loss-focused) or Optimistic (gain-focused)
- **MOTIVATION** (what they want): Achievement, Autonomy, Belonging, Competence, Empowerment, Engagement, Esteem, Nurturance, Security

Result: 18 distinct psychological profiles for hyper-targeted marketing

## The 18 Mindstates at a Glance

### Cautious (Loss-Prevention) Mindstates

| Mindstate | Core Driver | Key Message |
|-----------|------------|------------|
| **Cautious Achievement** | Avoid failure | "Don't settle - achieve your goals safely" |
| **Cautious Autonomy** | Avoid restrictions | "Stay true to yourself, your way" |
| **Cautious Belonging** | Avoid rejection | "Join a community that accepts you" |
| **Cautious Competence** | Avoid incompetence | "Master your skills with confidence" |
| **Cautious Empowerment** | Avoid helplessness | "Take control of your destiny" |
| **Cautious Engagement** | Avoid boredom | "Discover engaging experiences safely" |
| **Cautious Esteem** | Avoid insignificance | "Earn respect through achievement" |
| **Cautious Nurturance** | Avoid harm to others | "Care for those who matter" |
| **Cautious Security** | Avoid threats | "Protect what's important" |

### Optimistic (Gain-Seeking) Mindstates

| Mindstate | Core Driver | Key Message |
|-----------|------------|------------|
| **Optimistic Achievement** | Pursue excellence | "Become your best self" |
| **Optimistic Autonomy** | Seek freedom | "Express your unique identity" |
| **Optimistic Belonging** | Build connections | "Find your tribe" |
| **Optimistic Competence** | Develop skills | "Unlock your potential" |
| **Optimistic Empowerment** | Gain agency | "Make things happen" |
| **Optimistic Engagement** | Seek novelty | "Explore new possibilities" |
| **Optimistic Esteem** | Gain recognition | "Shine and be celebrated" |
| **Optimistic Nurturance** | Help others | "Make a positive impact" |
| **Optimistic Security** | Maximize safety | "Build a protected life" |

## Messaging Formulas

### For Cautious Mindstates
**Headline Formula**: "Avoid [pain] • Do [solution] • Prevent [worst outcome]"

**Examples**:
- "Don't waste time learning wrong techniques. Master the right way from day one."
- "Avoid expensive mistakes. Our proven system removes guesswork."
- "Stay independent without losing expertise. Your personalized path."

**Visual**: Show avoidance of negative outcomes, relief, safety, expertise, proof

**Tone**: Professional, reassuring, expert, confidence-building

---

### For Optimistic Mindstates
**Headline Formula**: "Unlock [benefit] • Become [aspiration] • Achieve [outcome]"

**Examples**:
- "Unleash your true potential. Become the best version of yourself."
- "Choose your own path. Create the life you've always imagined."
- "Join the community of winners. Your next chapter starts now."

**Visual**: Show transformation, success, growth, inspiration, possibility

**Tone**: Motivating, enthusiastic, aspirational, energetic

---

## 13 Cognitive Triggers (Heuristics) by Mindstate

Most triggered across all mindstates:

1. **Social Proof** - "Others like you chose this"
2. **Peak-End Rule** - Highlight best moments and clean endings
3. **Anchoring** - Set expectations with powerful first numbers
4. **Loss Aversion** - Emphasize what they'll lose if they don't act
5. **Sunk Cost** - Leverage prior investment ("You're already 80% there")
6. **Conformity** - Show that people like them are doing this
7. **Reciprocity** - Give something first to create obligation
8. **Authority** - Show expertise and credentials
9. **Scarcity** - Limited time/supply creates urgency
10. **In-Group Bias** - "People like us choose this"
11. **Egocentric Bias** - Frame as their personal success
12. **Status Quo Bias** - Make staying same more risky than changing
13. **Hyperbolic Discounting** - Make immediate benefits crystal clear

---

## Quick Selection Guide

**Ask yourself**: "What does this product prevent (Cautious) or enable (Optimistic)?"

### Achievement
- **Cautious**: "Helps avoid failure/obstacles to success"
  - Example: Study guides, professional development software
- **Optimistic**: "Helps achieve excellence/breakthrough success"
  - Example: Coaching, premium tools, mastermind groups

### Autonomy  
- **Cautious**: "Prevents being controlled/restricted"
  - Example: Customization features, personal security
- **Optimistic**: "Enables unique expression/freedom"
  - Example: Personalization, creative tools, self-expression

### Belonging
- **Cautious**: "Prevents rejection/isolation"
  - Example: Dating apps, community platforms, support groups
- **Optimistic**: "Builds deep connections/community"
  - Example: Social networks, clubs, team-building events

### Competence
- **Cautious**: "Prevents incompetence/skill loss"
  - Example: Training programs, quality assurance tools
- **Optimistic**: "Develops mastery/unlocks potential"
  - Example: Online courses, sports coaching, skill development

### Empowerment
- **Cautious**: "Prevents helplessness/loss of control"
  - Example: Insurance, security systems, financial planning
- **Optimistic**: "Gains agency/ability to make things happen"
  - Example: Project management tools, leadership programs

### Engagement
- **Cautious**: "Prevents monotony/missed opportunities"
  - Example: Intellectual challenges, novel experiences
- **Optimistic**: "Pursues novelty/exciting experiences"
  - Example: Travel, gaming, entertainment, hobbies

### Esteem
- **Cautious**: "Prevents irrelevance/being overlooked"
  - Example: Professional certifications, personal branding
- **Optimistic**: "Builds status/recognition/respect"
  - Example: Awards, premium services, luxury goods

### Nurturance
- **Cautious**: "Prevents harm to those they care for"
  - Example: Safety products, education, healthcare
- **Optimistic**: "Enables caring/making positive impact"
  - Example: Charitable giving, mentoring, volunteering platforms

### Security
- **Cautious**: "Prevents threats/losses to what they have"
  - Example: Insurance, backup systems, emergency planning
- **Optimistic**: "Builds stability/long-term protection"
  - Example: Investment platforms, long-term health plans

---

## Integration with Ad Creator

1. **Identify** the customer's dominant mindstate (motivation + approach)
2. **Extract** the corresponding profile: `getMindstateById("cautious-achievement")`
3. **Use** triggers array for Gemini image prompt engineering
4. **Apply** feelings to evoke for visual strategy
5. **Inject** copyTone and exampleHeadlines into copy generation
6. **Guide** AI with full profile formatted via `getMindstateGuidance()`

---

## Real-World Example

**Product**: Productivity software for busy executives

**Target Mindstate**: Cautious Empowerment
- "I don't want to feel out of control with my workload"
- "I need to be equipped to manage complexity"

**Messaging Formula**:
- "Take back control of your day" (prevent helplessness)
- "Delegate with confidence" (enable agency)
- Visual: Organized workspace, calm executive, clear systems
- Tone: Professional, empowering, solutions-focused
- Trigger: Anchoring ("3 hours/week saved") + Social Proof

---

**File**: `/src/lib/mindstate-data.ts`
**Updated**: 2026-03-21
**Status**: Production Ready
