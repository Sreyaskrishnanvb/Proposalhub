const mongoose = require("mongoose");
const QuestionSchema = new mongoose.Schema({

   studentName: String,
   studentId: String,
   department: String,
   academicYear: String,
   proposalTitle: String,
   projectType: String,
   duration: String,

   introduction: String,
   problemStatement: String,
   objectives: String,
   scopeOfWork: String,

   methodologies: String,
   tools: String,
   teamComposition: String,

   expectedOutcome: String,
   futureEnhancements: String,
   references: String

},{ strict: false });

module.exports = mongoose.model("Question", QuestionSchema);