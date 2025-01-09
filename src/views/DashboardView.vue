<template>
  <AppLayout>
    <template #content>
      <v-container>
        <!-- App Bar with Hamburger Menu -->
        <v-row justify="end" align="center" class="mb-6">
          <v-col cols="auto">
            <v-app-bar-nav-icon @click.stop="drawer = !drawer" />
          </v-col>
        </v-row>

        <!-- Right-Side Drawer -->
        <v-navigation-drawer
          v-model="drawer"
          app
          temporary
          right
        >
          <v-list>
            <!-- Home Option -->
            <v-list-item @click="navigateTo('home')">
              <v-list-item-icon>
                <v-icon>mdi-home</v-icon>
              </v-list-item-icon>
              <v-list-item-title>Home</v-list-item-title>
            </v-list-item>

            <!-- Profile Option -->
            <v-list-item @click="navigateTo('profile')">
              <v-list-item-icon>
                <v-icon>mdi-account</v-icon>
              </v-list-item-icon>
              <v-list-item-title>Profile</v-list-item-title>
            </v-list-item>

            <!-- Clinics Option -->
            <v-list-item @click="navigateTo('clinics')">
              <v-list-item-icon>
                <v-icon>mdi-hospital</v-icon>
              </v-list-item-icon>
              <v-list-item-title>Clinics</v-list-item-title>
            </v-list-item>

            <!-- Logout Option -->
            <v-list-item @click="handleLogout">
              <v-list-item-icon>
                <v-icon>mdi-logout</v-icon>
              </v-list-item-icon>
              <v-list-item-title>Log Out</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-navigation-drawer>

        <!-- Available Clinics Section -->
        <v-card class="pa-4 userinfo" v-if="user">
          <v-card-title class="user">You are successfully logged in!</v-card-title>
          <v-card-text>
            <p class=" user1">Email: {{ user.email }}</p>
            <p class="user1">
              Last Sign In: {{ new Date(user.last_sign_in_at).toLocaleString() }}
            </p>
          </v-card-text>
        </v-card>
        <br />
        <h1>Available Clinics</h1>
        <p class="mb-1">Click to book an appointment</p>

        <v-row class="gap-4">
          <!-- General Health Clinic -->
          <v-col cols="auto">
            <v-menu>
              <template v-slot:activator="{ props }">
                <v-btn class="available" v-bind="props" style="height: 58px;">
                  General Health<br />
                  Availability: Monday-Friday <br />
                  Slots left:
                </v-btn>
              </template>
              <v-list>
                <v-list-item
                  v-for="(item, index) in generalHealthItems"
                  :key="index"
                  :value="index"
                  @click="navigateToStaffDashboard(item.title)"
                >
                  <v-list-item-title>{{ item.title }}</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
          </v-col>

          <!-- Dental Clinic -->
          <v-col cols="auto">
            <v-menu>
              <template v-slot:activator="{ props }">
                <v-btn class="available" v-bind="props" style="height: 58px;">
                  Dental<br />
                  Availability: Monday-Friday <br />
                  Slots left:
                </v-btn>
              </template>
              <v-list>
                <v-list-item
                  v-for="(item, index) in dentalItems"
                  :key="index"
                  :value="index"
                  @click="navigateToStaffDashboard(item.title)"
                >
                  <v-list-item-title>{{ item.title }}</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
          </v-col>
        </v-row>
      </v-container>

      <br>
      <h1 class="mt-3 services text-center">Our Services</h1>
      <br> <br>
      <h3 class="gentitle">General Health Clinic</h3>
        <v-row>
    <v-col cols="12" md="4">
      <v-card class="genhealth"
        subtitle="tempo"
        text="Lorem ipsum dolor sit amet consectetur adipisicing elit. Commodi, ratione debitis quis est labore voluptatibus!"
        title="Health"
      ></v-card>
    </v-col>

    <v-col cols="12" md="4">
      <v-card class="firstaid">
        <template v-slot:title>
          First-Aid
        </template>

        <template v-slot:subtitle>
          tempo
        </template>

        <template v-slot:text>
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Commodi, ratione debitis quis est labore voluptatibus!
        </template>
      </v-card>
    </v-col>

    <v-col cols="12" md="4">
      <v-card class="pres">
        <v-card-item>
          <v-card-title>Prescriptions and Pharmacy</v-card-title>

          <v-card-subtitle>tempo</v-card-subtitle>
        </v-card-item>

        <v-card-text>
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Commodi, ratione debitis quis est labore voluptatibus!
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
  <br>
  <br>
  <h3 class="dentitle">Dental Clinic</h3>
        <v-row>
    <v-col cols="12" md="4">
      <v-card class="teethcleaning"
        subtitle="tempo"
        text="Lorem ipsum dolor sit amet consectetur adipisicing elit. Commodi, ratione debitis quis est labore voluptatibus!"
        title="Teeth Cleaning"
      ></v-card>
    </v-col>

    <v-col cols="12" md="4">
      <v-card class="dental">
        <template v-slot:title>
          Dental Exams
        </template>

        <template v-slot:subtitle>
          tempo
        </template>

        <template v-slot:text>
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Commodi, ratione debitis quis est labore voluptatibus!
        </template>
      </v-card>
    </v-col>
  </v-row>
  <br>
  <br>
  <h2 class="about text-center mt-5">About Us</h2>
  <p class="about1">Lorem ipsum dolor sit amet consectetur adipisicing elit. Commodi, ratione debitis quis est labore voluptatibus. Lorem ipsum dolor sit amet consectetur adipisicing elit. Commodi, ratione debitis quis est labore voluptatibus. Lorem ipsum dolor sit amet consectetur adipisicing elit. Commodi, ratione debitis quis est labore voluptatibus!</p>

    </template>
  </AppLayout>
</template>

<script setup>
import AppLayout from "@/components/layout/AppLayout.vue";
import { onMounted, ref } from "vue";
import { supabase } from "@/supabase";
import { useRouter } from "vue-router";

const drawer = ref(false); // Controls drawer visibility
const router = useRouter();
const user = ref(null);
const loading = ref(false);

const generalHealthItems = ref([
  { title: "Health Clinics" },
  { title: "First Aid" },
  { title: "Prescriptions and Pharmacy" },
]);

const dentalItems = ref([
  { title: "Teeth Cleaning" },
  { title: "Dental Exams" },
]);

onMounted(async () => {
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  if (!currentUser) {
    router.push("/");
    return;
  }
  user.value = currentUser;
});

function navigateToStaffDashboard(itemTitle) {
  console.log(`Navigating to staff dashboard with item: ${itemTitle}`);
  router.push({ name: "staff-dashboard", query: { item: itemTitle } });
}

function navigateTo(routeName) {
  drawer.value = false;
  router.push({ name: routeName });
}

async function handleLogout() {
  try {
    loading.value = true;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    router.push("/");
  } catch (e) {
    console.error("Error logging out:", e.message);
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.userinfo {
  height: 105px;
}
.user{
  font-size: 18px;
}
.user1{
  font-size: 15px;
}
.available{
  background: #34c759;
}
/* Glass Style for Cards */
.genhealth, .firstaid, .pres, 
.teethcleaning, .dental {
  border: 2px solid rgba(255, 255, 255, 0.2); /* Subtle border */
  border-radius: 15px; /* Rounded corners */
  background: rgba(255, 255, 255, 0.2); /* Transparent background */
  backdrop-filter: blur(10px); /* Blur effect */
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25); /* Soft shadow */
  transition: all 0.3s ease; /* Smooth transition for hover effects */
  cursor: pointer;
}

.genhealth:hover, 
.dental:hover, 
.teethcleaning:hover, 
.firstaid:hover, 
.pres:hover {
  border-color: #4daf50; /* Highlight on hover */
  transform: scale(1.05); /* Slight enlargement on hover */
}

/* General Layout */

.gentitle, .dentitle {
  text-align: left;
  margin-bottom: 20px;
  color: black;
}

/* Buttons - Glass Style */
v-btn {
  background: rgba(255, 255, 255, 0.15) !important;
  border: 1px solid rgba(255, 255, 255, 0.3) !important;
  backdrop-filter: blur(8px) !important;
  color: #fff !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2) !important;
  text-transform: capitalize !important;
}

/* Navigation Drawer */
v-navigation-drawer {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
}

/* Text Customization */
h3 {
  color: #fff;
  text-shadow: 1px 1px 4px rgba(0, 0, 0, 0.5);
}
</style>
