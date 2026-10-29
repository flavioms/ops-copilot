/** One iteration = one model call plus the tool step that follows it (LangGraph counts both). */
export const recursionLimitFor = (maxIterations: number) => 2 * maxIterations;
