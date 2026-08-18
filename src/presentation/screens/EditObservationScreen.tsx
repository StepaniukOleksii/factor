import React, {useEffect, useRef, useState} from 'react';
import {Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View} from 'react-native';
import {MaterialIcons} from '@expo/vector-icons';
import type {NavigationAction} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SQLiteObservationRepository} from '../../infrastructure/SQLiteObservationRepository';
import {UpdateObservationUseCase} from '../../application/UpdateObservationUseCase';
import {
    hasErrors,
    type ObservationIdentityErrors,
    validateObservationIdentity,
} from '../../application/validateCreateObservation';
import {Observation} from '../../domain/Observation';
import {OBSERVATION_DESCRIPTION_MAX_LENGTH, OBSERVATION_NAME_MAX_LENGTH} from '../../domain/validationLimits';
import {
    CenteredState,
    Dialog,
    FooterBar,
    LabeledTextField,
    PrimaryActionButton,
    ScreenContainer,
    ScreenHeader,
    useFooterClearance,
} from "@presentation/components";
import {COLORS} from "@presentation/theme";
import type {RootStackParamList} from '../navigation/routes';

const repository = new SQLiteObservationRepository();
const useCase = new UpdateObservationUseCase(repository);

export type EditObservationScreenProps = NativeStackScreenProps<RootStackParamList, 'EditObservation'>;

const NOTHING_MARKED: ObservationIdentityErrors = {};

export function EditObservationScreen({route, navigation}: EditObservationScreenProps) {
    const {observationId} = route.params;

    const [observation, setObservation] = useState<Observation | null>(null);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [takenNames, setTakenNames] = useState<string[]>([]);
    const [attemptedSave, setAttemptedSave] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    /** The removal an exit was intercepted on, held while the user decides. */
    const [pendingExit, setPendingExit] = useState<NavigationAction | null>(null);
    const footerClearance = useFooterClearance();
    /**
     * Saving removes this route too, and the form is still dirty against the
     * Observation it loaded at that moment, so that one removal has to pass. A
     * ref rather than state: the listener has to see it within the same tick.
     */
    const leavingAfterSave = useRef(false);

    const onBack = () => navigation.goBack();

    // One read supplies both the subject and the names to compare against, so
    // the table is opened once. A failed load leaves the screen `Not found`; the
    // use case refuses a bad save regardless.
    useEffect(() => {
        setLoading(true);
        repository.findAll()
            .then(observations => {
                const subject = observations.find(candidate => candidate.id === observationId) ?? null;
                setObservation(subject);
                setName(subject?.name ?? '');
                setDescription(subject?.description ?? '');
                setTakenNames(observations
                    .filter(candidate => candidate.id !== observationId)
                    .map(candidate => candidate.name));
            })
            .catch(error => console.error('Failed to load observation', error))
            .finally(() => setLoading(false));
    }, [observationId]);

    const errors = validateObservationIdentity(name, description, takenNames);
    // Judged every render but withheld until the user has tried to save, as the
    // creation form withholds its own. A stored value past its limit is marked
    // like anything else: the form judges what it holds, not what was typed.
    const marked = attemptedSave ? errors : NOTHING_MARKED;

    // The loaded Observation is the baseline, trimmed on both sides so trailing
    // whitespace that would save nothing does not count as a change. A stored
    // description of `null` is `''` on the form.
    const isDirty = !!observation
        && (name.trim() !== observation.name.trim()
            || description.trim() !== (observation.description ?? '').trim());

    // One listener covers every route off this screen - the header arrow, the
    // cross button, Android's back button and the system back gesture are all
    // route removals. Taken from the `navigation` prop rather than a hook, both
    // of which need a navigator above them: the screen's tests render it bare.
    useEffect(() => {
        return navigation.addListener('beforeRemove', event => {
            if (leavingAfterSave.current || !isDirty) {
                return;
            }
            event.preventDefault();
            // The event's own action, so discarding lands the user wherever they
            // were headed rather than at a hardcoded destination.
            setPendingExit(event.data.action);
        });
    }, [navigation, isDirty]);

    const handleKeepEditing = () => setPendingExit(null);

    const handleDiscard = () => {
        const action = pendingExit;
        setPendingExit(null);
        if (action) {
            navigation.dispatch(action);
        }
    };

    const handleSave = async () => {
        setAttemptedSave(true);
        if (hasErrors(errors)) {
            return;
        }
        try {
            setSaving(true);
            await useCase.execute({observationId, name, description});
            // Only the success path stands the listener down, so a save that
            // throws leaves the next exit still intercepted.
            leavingAfterSave.current = true;
            navigation.goBack();
        } catch (error: any) {
            // The last resort, for what no field is holding: the write failing,
            // or the Observation having been deleted meanwhile.
            Alert.alert('Error', error.message || 'An error occurred while saving.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <ScreenContainer>
                <ScreenHeader title="Loading..." onBack={onBack}/>
                <CenteredState/>
            </ScreenContainer>
        );
    }

    if (!observation) {
        return (
            <ScreenContainer>
                <ScreenHeader title="Not found" onBack={onBack}/>
                <CenteredState message="Observation not found."/>
            </ScreenContainer>
        );
    }

    return (
        <ScreenContainer>
            <ScreenHeader
                title="Edit Observation"
                onBack={onBack}
                rightAction={
                    <TouchableOpacity onPress={onBack} accessibilityLabel="Cancel editing">
                        <MaterialIcons name="close" size={24} color={COLORS.primary}/>
                    </TouchableOpacity>
                }
            />

            <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={[styles.scrollContent, {paddingBottom: footerClearance}]}>
                    <View style={styles.fields}>
                        <LabeledTextField
                            label="OBSERVATION NAME"
                            value={name}
                            onChangeText={setName}
                            placeholder="e.g., Sleep Quality, Mood"
                            maxLength={OBSERVATION_NAME_MAX_LENGTH}
                            showCounter
                            error={marked.name}
                        />
                        <LabeledTextField
                            label="DESCRIPTION"
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Optional — what does this observation track?"
                            multiline
                            numberOfLines={3}
                            maxLength={OBSERVATION_DESCRIPTION_MAX_LENGTH}
                            showCounter
                            error={marked.description}
                        />
                    </View>
                </ScrollView>

                <FooterBar>
                    <PrimaryActionButton label="Save Observation" onPress={handleSave} loading={saving}/>
                </FooterBar>
            </KeyboardAvoidingView>

            {/* The form keeps its state throughout, so keeping the edit
                restores nothing. */}
            <Dialog
                visible={pendingExit !== null}
                title="Discard changes?"
                message="The changes you made to this observation will be lost."
                onRequestClose={handleKeepEditing}
                actions={[
                    {
                        label: "Keep editing",
                        onPress: handleKeepEditing,
                        accessibilityLabel: "Keep editing this observation",
                    },
                    {
                        label: "Discard",
                        onPress: handleDiscard,
                        variant: "destructive",
                        accessibilityLabel: "Discard unsaved changes",
                    },
                ]}
            />
        </ScreenContainer>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    fields: {
        gap: 16,
    },
});
