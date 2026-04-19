const grades = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];

const gradeMultiplier = {
    F: 0,
    E: 1,
    D: 2,
    C: 3,
    B: 4,
    A: 5,
    S: 6
};

const durabilityValues = {
    F: 100, E: 120, D: 150, C: 180, B: 220, A: 260, S: 300
};

const upgradeCosts = {
    F: 500, E: 1200, D: 2500, C: 5000, B: 10000, A: 20000, S: 0
};

const repairCostPerDurability = {
    F: 1, E: 2, D: 3, C: 5, B: 8, A: 12, S: 20
};

function getNextGrade(current) {
    const idx = grades.indexOf(current);
    return idx >= 0 && idx < grades.length - 1 ? grades[idx + 1] : null;
}

function getGradeIncrementCount(grade) {
    return gradeMultiplier[grade] || 0;
}

module.exports = {
    grades,
    gradeMultiplier,
    durabilityValues,
    upgradeCosts,
    repairCostPerDurability,
    getNextGrade,
    getGradeIncrementCount
};