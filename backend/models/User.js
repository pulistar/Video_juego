const mongoose = require('mongoose')

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 32
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    passwordHash: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true
  }
)

userSchema.methods.toSafeObject = function toSafeObject() {
  const { _id, username, email, createdAt, updatedAt } = this
  return { id: _id.toString(), username, email, createdAt, updatedAt }
}

module.exports = mongoose.model('User', userSchema)
