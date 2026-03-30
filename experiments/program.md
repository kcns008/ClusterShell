# program.md Template

Lightweight agent instruction file for autonomous experiments.

## Overview

The `program.md` pattern (inspired by [autoresearch](https://github.com/karpathy/autoresearch)) provides a simple way to define agent behavior for autonomous experiments. Instead of writing complex skill files, you write a Markdown file that tells the agent:

1. **What to optimize** (the goal/metric)
2. **What it can modify** (the search space)
3. **How to evaluate** (the test harness)
4. **How to log results** (the format)

## Template

```markdown
# Experiment: <Name>

## Goal
<What metric to optimize and direction (minimize/maximize)>

## Time Budget
<Fixed time per experiment, e.g., "5 minutes">

## What to Modify
- `<file/path>`: <what parameters, what ranges>
- `<another/file>`: <description>

## What NOT to Modify
- `<file>`: <reason it's off-limits>

## Evaluation
```bash
<command to run>
<how to extract the metric>
```

## Logging
Record in `results.tsv`:
commit\t<col1>\t<col2>\tstatus\tdescription

## Simplicity Criterion
<When to prefer simpler solutions>
```

## Example: Code Optimization

```markdown
# Experiment: Router Latency

## Goal
Minimize p99 request latency while maintaining accuracy >= 99%.

## Time Budget
3 minutes per experiment.

## What to Modify
- `crates/clustershell-router/src/pool.rs`: connection pool size (10-1000)
- `crates/clustershell-router/src/cache.rs`: cache TTL (1s-1h)
- `crates/clustershell-router/src/batch.rs`: batch size (1-100)

## Evaluation
```bash
cargo bench --bench router_latency 2>&1 | grep "p99:"
# Extract latency value
```

## Logging
commit\tp99_ms\taccuracy\tstatus\tdescription

## Simplicity Criterion
A 5ms improvement with 20 lines of code is worse than a 3ms improvement that deletes 10 lines.
```

## Example: Model Training

```markdown
# Experiment: Model Accuracy

## Goal
Maximize validation accuracy.

## Time Budget
5 minutes per experiment (fixed, regardless of model size).

## What to Modify
- `train.py`: model architecture (depth, width, attention pattern)
- `train.py`: optimizer settings (lr, weight decay)
- `train.py`: data augmentation

## What NOT to Modify
- `prepare.py`: data loading and evaluation (fixed constants)
- `pyproject.toml`: no new dependencies

## Evaluation
```bash
uv run train.py > run.log 2>&1
grep "^val_accuracy:" run.log
```

## Logging
commit\tval_accuracy\tparams_M\tstatus\tdescription

## Never Stop
This experiment runs autonomously. Do not pause to ask for confirmation.
The human may be asleep. Continue until manually interrupted.
```

## Key Principles

### 1. Fixed Time Budget
Every experiment runs for the same duration. This makes results comparable regardless of:
- Model size changes
- Batch size changes
- Platform differences

### 2. Never Stop
The agent runs continuously until interrupted. This enables:
- "Run while you sleep" workflows
- 100+ experiments overnight
- No waiting for human decisions

### 3. Log Everything
Every experiment is recorded:
- Successful improvements (keep)
- Unsuccessful attempts (discard)
- Crashes and failures (crash)

### 4. Git as State Machine
The git history becomes the experiment log:
- Each experiment = one commit
- Advancing = git keeps the commit
- Discarding = git reset back

### 5. Simplicity Wins
Complex changes need larger improvements:
- Small gain + simple code = keep
- Large gain + complex code = maybe
- Small gain + complex code = discard

## Integration with ClusterShell

Run experiments in sandboxes for isolation:

```bash
# Create experiment sandbox
clustershell sandbox create --name exp-router --from base

# Connect and run
clustershell sandbox connect exp-router
# Agent runs program.md instructions here

# When done
clustershell sandbox delete exp-router
```

## Multiple Program Files

Different experiments can have different `program.md` files:

```
experiments/
├── latency-opt/
│   ├── program.md     # Optimize for latency
│   └── results.tsv
├── accuracy-opt/
│   ├── program.md     # Optimize for accuracy
│   └── results.tsv
└── memory-opt/
    ├── program.md     # Optimize for memory
    └── results.tsv
```

## Comparison with Full Skills

| Aspect | program.md | Full Skill |
|--------|------------|------------|
| Setup | One file | SKILL.md + scripts |
| Complexity | Simple | Rich |
| Reusability | Project-specific | Reusable |
| Tool integration | Manual | Automatic |
| Best for | Experiments | Workflows |

## See Also

- `autonomous-experiment` skill - Running experiment loops
- `experiment-tracking` skill - Analyzing results
- [autoresearch](https://github.com/karpathy/autoresearch) - Original inspiration
