<script setup>
import AppLayout from '@/components/layout/AppLayout.vue'
import { ref } from 'vue'
import { supabase } from '@/supabase'
import { useRouter } from 'vue-router'

const router = useRouter()
const loading = ref(false)
const error = ref(null)

const form = ref({
  email: '',
  password: '',
})

async function handleLogin() {
  try {
    loading.value = true
    error.value = null
    
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: form.value.email,
      password: form.value.password,
    })

    if (authError) throw authError

    // Successful login
    router.push('/dashboard')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>


<template>
  <AppLayout>
    <template #content>
      <v-row class="d-flex justify-between align-center mt-5">
        <!-- Left Side: Text Content -->
        <v-col cols="12" md="6" class="text-section">
          <div class="text-container">
            <h1 class="welcome-animation" @mouseover="startAnimation" @mouseleave="resetAnimation">Welcome to CareLink</h1>
            <p style="margin-left: 58px; color:#000000; font-size: 18px;">
              University Clinic Appointment Booking System
            </p>
          </div>
        </v-col>

        <!-- Right Side: Login Form -->
        <v-col cols="12" md="6">
          <v-card
            class="login-form mx-auto"
            color="grey-lighten-1"
            rounded="lg"
            elevation="8"
          >
            <template v-slot:title>
              <div class="text-center fs-5 mb-4" style="font-weight: bold; font-size: 2rem">
                CareLink
              </div>
            </template>

            <v-card-text class="bg-surface-light pt-4">
              <v-form fast-fail @submit.prevent="handleLogin">
                <v-alert
                  v-if="error"
                  type="error"
                  class="mb-4"
                  closable
                  @click:close="error = null"
                >
                  {{ error }}
                </v-alert>

                <p>Email:</p>
                <v-text-field
                  v-model="form.email"
                  prepend-inner-icon="mdi-email"
                  label="Enter your email"
                  color="green"
                  placeholder="Email"
                  :rules="[v => !!v || 'Email is required']"
                  required
                ></v-text-field>

                <p>Password:</p>
                <v-text-field
                  v-model="form.password"
                  prepend-inner-icon="mdi-lock"
                  label="Enter your password"
                  color="green"
                  placeholder="Password"
                  type="password"
                  :rules="[v => !!v || 'Password is required']"
                  required
                ></v-text-field>

                <v-btn
                  class="rounded-s-lg"
                  type="submit"
                  block
                  color="green-darken-3"
                  :loading="loading"
                >
                  Log in
                </v-btn>
              </v-form>
              <v-divider class="my-5"></v-divider>
              <h5 class="text-center">
                Don't have an account?
                <router-link to="/register" style="color: #000000;"><b>Click here to Register</b></router-link>
              </h5>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </template>
  </AppLayout>
</template>

<script>
export default {
  data() {
    return {
      form: {
        email: '',
        password: ''
      },
      error: null,
      loading: false
    };
  },
  methods: {
    handleLogin() {
      // Handle login logic here
    },
    startAnimation() {
      // You can add or change CSS classes dynamically if necessary
      this.$el.querySelector('.welcome-animation').classList.add('hover-animate');
    },
    resetAnimation() {
      this.$el.querySelector('.welcome-animation').classList.remove('hover-animate');
    }
  }
};
</script>

<style scoped>
/* Styling for text section */
.text-container {
  margin: 20px;
  padding: 20px;
  font-size: 1.2rem;
}

.text-container p {
  line-height: 1.6;
  color: #555;
}

/* Welcome Animation */
.welcome-animation {
  font-size: 2.5rem;
  font-weight: bold;
  background: linear-gradient(90deg, #4caf50, #8bc34a, #4caf50);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: gradientBounce 3s infinite, fadeInScale 1.5s ease-out;
  text-align: center;
  cursor: pointer;
}

/* Hovered Animation */
.welcome-animation.hover-animate {
  animation: gradientBounce 3s infinite, scaleHover 1s ease-out;
}

/* Gradient Bounce Animation */
@keyframes gradientBounce {
  0%, 100% {
    background-position: 0%;
  }
  50% {
    background-position: 100%;
  }
}

/* Fade In and Scale Animation */
@keyframes fadeInScale {
  0% {
    opacity: 0;
    transform: scale(0.8);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

/* Hover Scale Animation */
@keyframes scaleHover {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
}

/* Styling for login form */
.login-form {
  width: 480px;
  margin-left: auto;
}

@media (max-width: 768px) {
  .text-container {
    text-align: center;
  }

  .login-form {
    width: 90%;
    margin: auto;
  }
}
</style>

