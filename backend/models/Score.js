const mongoose = require('mongoose')

const scoreSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    username: {
      type: String,
      required: true,
      trim: true
    },
    points: {
      type: Number,
      required: true,
      min: 0
    },
    durationSeconds: {
      type: Number,
      required: true,
      min: 0
    },
    level: {
      type: Number,
      required: true,
      min: 1
    },
    maxLevelReached: {
      type: Number,
      default: function() { return this.level },
      min: 1
    },
    sessionType: {
      type: String,
      enum: ['completed', 'died', 'quit'],
      default: 'died'
    }
  },
  {
    timestamps: true
  }
)

scoreSchema.index({ points: -1, durationSeconds: 1 })

module.exports = mongoose.model('Score', scoreSchema)
