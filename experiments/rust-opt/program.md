# Experiment: Rust Code Optimization

## Goal
Minimize the runtime of the `clustershell-core` unit tests while maintaining all tests passing.

## Time Budget
30 seconds per experiment (quick iteration).

## What to Modify
- `crates/clustershell-core/src/*.rs`: Algorithm optimizations, data structure choices
- `crates/clustershell-core/Cargo.toml`: Feature flags, optimization settings

## What NOT to Modify
- Test assertions (must keep same behavior)
- Other crates (focus on core only)

## Evaluation
```bash
cargo test --package clustershell-core --release 2>&1 | tail -5
# Extract: "Finished in X.XXs"
```

## Logging
Record in `experiments/results.tsv`:
```
commit	runtime_s	test_result	status	description
```

## Simplicity Criterion
A 0.1s improvement that deletes code is better than a 0.5s improvement that adds 50 lines.

## Never Stop
This experiment runs autonomously. Do not pause for confirmation.
Continue until manually interrupted or 20 experiments are completed.
