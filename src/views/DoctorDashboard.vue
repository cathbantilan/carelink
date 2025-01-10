<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '@/supabase'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const availableSlots = ref([])
const appointments = ref([])
const newSlot = ref({
  date: null,
  time: '',
  duration: 30,
  notes: ''
})
const loading = ref(false)
const error = ref(null)
const showNotesDialog = ref(false)
const selectedAppointment = ref(null)
const doctorNotes = ref('')

// Time slots in 24-hour format with AM/PM
const timeSlots = [
  { value: '08:00', label: '8:00 AM' },
  { value: '08:30', label: '8:30 AM' },
  { value: '09:00', label: '9:00 AM' },
  { value: '09:30', label: '9:30 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '10:30', label: '10:30 AM' },
  { value: '11:00', label: '11:00 AM' },
  { value: '11:30', label: '11:30 AM' },
  { value: '13:00', label: '1:00 PM' },
  { value: '13:30', label: '1:30 PM' },
  { value: '14:00', label: '2:00 PM' },
  { value: '14:30', label: '2:30 PM' },
  { value: '15:00', label: '3:00 PM' },
  { value: '15:30', label: '3:30 PM' },
  { value: '16:00', label: '4:00 PM' },
  { value: '16:30', label: '4:30 PM' }
]

const durationOptions = [
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' }
]

onMounted(async () => {
  await Promise.all([
    fetchMySlots(),
    fetchAppointments()
  ])
})

function formatTime(time) {
  const [hours, minutes] = time.split(':')
  const hour = parseInt(hours)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12}:${minutes} ${ampm}`
}

async function fetchMySlots() {
  try {
    loading.value = true
    const { data: { user } } = await supabase.auth.getUser()
    
    const { data, error: fetchError } = await supabase
      .from('available_slots')
      .select('*')
      .eq('doctor_id', user.id)
      .order('date', { ascending: true })
      .order('time', { ascending: true })

    if (fetchError) throw fetchError
    
    availableSlots.value = data.map(slot => ({
      ...slot,
      formattedTime: formatTime(slot.time)
    }))
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function fetchAppointments() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    const { data, error: fetchError } = await supabase
      .from('appointments')
      .select(`
        *,
        patient:patient_id (
          email,
          profiles (
            first_name,
            last_name
          )
        ),
        slot:slot_id (
          date,
          time,
          duration,
          notes
        )
      `)
      .eq('slot:slot_id.doctor_id', user.id)
      .order('created_at', { ascending: false })

    if (fetchError) throw fetchError

    appointments.value = data.map(appointment => ({
      ...appointment,
      formattedTime: formatTime(appointment.slot.time),
      patientName: `${appointment.patient.profiles[0].first_name} ${appointment.patient.profiles[0].last_name}`
    }))
  } catch (e) {
    error.value = e.message
  }
}

async function addTimeSlot() {
  if (!newSlot.value.date || !newSlot.value.time) {
    error.value = 'Please select both date and time'
    return
  }

  try {
    loading.value = true
    const { data: { user } } = await supabase.auth.getUser()

    // Check for existing slot
    const { data: existingSlot } = await supabase
      .from('available_slots')
      .select('*')
      .eq('date', newSlot.value.date)
      .eq('time', newSlot.value.time)
      .eq('doctor_id', user.id)
      .single()

    if (existingSlot) {
      throw new Error('You already have a slot at this time')
    }

    // Add new slot
    const { error: insertError } = await supabase
      .from('available_slots')
      .insert({
        doctor_id: user.id,
        date: newSlot.value.date,
        time: newSlot.value.time,
        duration: newSlot.value.duration,
        notes: newSlot.value.notes,
        is_booked: false
      })

    if (insertError) throw insertError

    await Promise.all([
      fetchMySlots(),
      fetchAppointments()
    ])
    
    newSlot.value = { date: null, time: '', duration: 30, notes: '' }
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function updateAppointmentStatus(appointment, newStatus) {
  try {
    loading.value = true
    const { error: updateError } = await supabase
      .from('appointments')
      .update({ 
        status: newStatus,
        notes: newStatus === 'confirmed' ? doctorNotes.value : null 
      })
      .eq('id', appointment.id)

    if (updateError) throw updateError

    if (newStatus === 'cancelled') {
      const { error: slotError } = await supabase
        .from('available_slots')
        .update({ is_booked: false })
        .eq('id', appointment.slot_id)

      if (slotError) throw slotError
    }

    showNotesDialog.value = false
    selectedAppointment.value = null
    doctorNotes.value = ''
    
    await Promise.all([
      fetchMySlots(),
      fetchAppointments()
    ])
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function openNotesDialog(appointment) {
  selectedAppointment.value = appointment
  doctorNotes.value = appointment.notes || ''
  showNotesDialog.value = true
}

async function handleLogout() {
  try {
    loading.value = true
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    router.push('/login')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function updateSlotStatus(slot) {
  try {
    loading.value = true
    const { error: updateError } = await supabase
      .from('available_slots')
      .update({ 
        is_booked: !slot.is_booked,
        // If marking as unavailable, add a note
        notes: !slot.is_booked ? 'Marked as unavailable by doctor' : null
      })
      .eq('id', slot.id)

    if (updateError) throw updateError

    // If marking as unavailable and there's an appointment, cancel it
    if (!slot.is_booked && slot.appointments?.[0]) {
      const { error: appointmentError } = await supabase
        .from('appointments')
        .update({ 
          status: 'cancelled',
          notes: 'Cancelled by doctor - slot marked as unavailable'
        })
        .eq('id', slot.appointments[0].id)

      if (appointmentError) throw appointmentError
    }

    await Promise.all([
      fetchMySlots(),
      fetchAppointments()
    ])
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
      <v-container>
        <v-row class="mb-6">
          <v-col cols="12" class="d-flex justify-space-between align-center">
            <h1 class="text-h4">Doctor Dashboard</h1>
            <v-btn
              color="error"
              @click="handleLogout"
              :loading="loading"
              prepend-icon="mdi-logout"
            >
              Logout
            </v-btn>
          </v-col>
        </v-row>
        
        <v-alert
          v-if="error"
          type="error"
          class="mb-4"
          closable
          @click:close="error = null"
        >
          {{ error }}
        </v-alert>

        <v-card class="mb-6">
          <v-card-title class="text-h5 pa-4">
            Add New Time Slot
          </v-card-title>
          
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6">
                <v-date-picker
                  v-model="newSlot.date"
                  :min="new Date().toISOString().split('T')[0]"
                  class="mx-auto"
                ></v-date-picker>
              </v-col>

              <v-col cols="12" md="6">
                <v-select
                  v-model="newSlot.time"
                  :items="timeSlots"
                  item-title="label"
                  item-value="value"
                  label="Select Time"
                  class="mb-4"
                  hint="Philippine Time (PHT)"
                  persistent-hint
                ></v-select>

                <v-select
                  v-model="newSlot.duration"
                  :items="durationOptions"
                  item-title="label"
                  item-value="value"
                  label="Duration"
                  class="mb-4"
                ></v-select>

                <v-btn
                  color="primary"
                  :loading="loading"
                  :disabled="!newSlot.date || !newSlot.time"
                  @click="addTimeSlot"
                  block
                >
                  Add Time Slot
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <v-card>
          <v-card-title class="text-h5 pa-4">
            My Appointments
          </v-card-title>
          
          <v-card-text>
            <v-data-table
              :headers="[
                { title: 'Date', key: 'date', align: 'start' },
                { title: 'Time', key: 'formattedTime', align: 'start' },
                { title: 'Duration', key: 'duration', align: 'start' },
                { title: 'Patient', key: 'patientName', align: 'start' },
                { title: 'Status', key: 'status', align: 'start' },
                { title: 'Actions', key: 'actions', align: 'center' }
              ]"
              :items="availableSlots"
              :loading="loading"
              class="elevation-1"
            >
              <template v-slot:item.duration="{ item }">
                {{ item.duration }} minutes
              </template>

              <template v-slot:item.patientName="{ item }">
                <span v-if="item.patientName">{{ item.patientName }}</span>
                <span v-else class="text-grey">No patient</span>
              </template>
              
              <template v-slot:item.status="{ item }">
                <v-chip
                  v-if="item.is_booked"
                  :color="item.appointmentStatus === 'confirmed' ? 'success' : 'warning'"
                  size="small"
                >
                  {{ item.appointmentStatus }}
                </v-chip>
                <v-chip
                  v-else
                  color="info"
                  size="small"
                >
                  Available
                </v-chip>
              </template>

              <template v-slot:item.actions="{ item }">
                <div class="d-flex justify-center gap-2">
                  <v-btn
                    v-if="item.is_booked && item.appointmentStatus === 'pending'"
                    color="success"
                    size="small"
                    @click="updateAppointmentStatus(item.appointments[0], 'confirmed')"
                  >
                    Confirm
                  </v-btn>

                  <v-btn
                    v-if="item.is_booked"
                    color="error"
                    size="small"
                    @click="updateSlotStatus(item)"
                  >
                    Cancel
                  </v-btn>

                  <v-btn
                    v-if="!item.is_booked"
                    color="primary"
                    size="small"
                    @click="updateSlotStatus(item)"
                  >
                    Mark Unavailable
                  </v-btn>
                </div>
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-container>
    </template>
  </AppLayout>
</template>

<style scoped>
.v-card {
  margin-bottom: 20px;
}

.v-btn {
  margin-top: 20px;
}

.v-data-table {
  background-color: white;
}

.text-h4 {
  color: #1976d2;
  font-weight: 600;
}

.text-h5 {
  color: #1976d2;
  font-weight: 500;
}

.gap-2 {
  gap: 8px;
}
</style> 