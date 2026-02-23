const { initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');
const { createClient } = require('@supabase/supabase-js');

// Initialize a dedicated Supabase client for backend operations
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Must use service role for reading/writing all clinics
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Creates a Baileys AuthState that uses Supabase as the storage backend.
 * This is crucial for multi-tenant SaaS to ensure sessions survive server restarts
 * and can be horizontally scaled.
 *
 * @param {string} clinicId - The UUID of the clinic owning this session
 */
const useSupabaseAuthState = async (clinicId) => {
    // 1. Fetch existing session data from Supabase
    const { data: sessionRow, error: fetchError } = await supabase
        .from('whatsapp_sessions')
        .select('session_data')
        .eq('clinic_id', clinicId)
        .single();

    let creds;
    let keys = {};

    if (fetchError && fetchError.code !== 'PGRST116') {
        console.error(`Error fetching auth state for ${clinicId}:`, fetchError);
        throw fetchError;
    }

    // Try parsing existing state or initialize fresh
    if (sessionRow && sessionRow.session_data && Object.keys(sessionRow.session_data).length > 0) {
        try {
            const parsed = JSON.parse(JSON.stringify(sessionRow.session_data), BufferJSON.reviver);
            creds = parsed.creds || initAuthCreds();
            keys = parsed.keys || {};
        } catch (e) {
            console.error('Failed to parse existing auth state:', e);
            creds = initAuthCreds();
        }
    } else {
        creds = initAuthCreds();
    }

    // Wrap the writing process to decouple saving from immediately blocking the thread
    let saveTimer = null;

    // 2. The `saveCreds` function called by Baileys
    const saveState = () => {
        // Debounce saves slightly to prevent rapid DB spikes during initial sync
        if (saveTimer) clearTimeout(saveTimer);

        saveTimer = setTimeout(async () => {
            try {
                const stateData = JSON.parse(JSON.stringify({ creds, keys }, BufferJSON.replacer));

                const { error } = await supabase
                    .from('whatsapp_sessions')
                    .upsert({
                        clinic_id: clinicId,
                        session_data: stateData,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'clinic_id' });

                if (error) {
                    console.error(`[SupabaseAuthState] Error saving state for ${clinicId}:`, error);
                }
            } catch (err) {
                console.error(`[SupabaseAuthState] Save failed for ${clinicId}:`, err);
            }
        }, 1000);
    };

    return {
        state: {
            creds,
            keys: {
                get: (type, ids) => {
                    const dict = {};
                    for (let id of ids) {
                        const key = `${type}-${id}`;
                        let val = keys[key];
                        if (val) {
                            if (type === 'app-state-sync-key') {
                                val = BufferJSON.reviver('', val);
                            }
                            dict[id] = val;
                        }
                    }
                    return dict;
                },
                set: (data) => {
                    for (let category in data) {
                        for (let id in data[category]) {
                            const val = data[category][id];
                            const key = `${category}-${id}`;
                            if (val) {
                                keys[key] = val;
                            } else {
                                delete keys[key];
                            }
                        }
                    }
                    saveState();
                }
            }
        },
        saveCreds: saveState
    };
};

module.exports = { useSupabaseAuthState, supabase };
