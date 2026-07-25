import { Button, Radio } from 'twenty-ui/input';
import { MenuItemSelect } from 'twenty-ui/navigation';
import { IconMinus } from 'twenty-ui/icon';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { addDays } from 'date-fns';
import { enUS } from 'date-fns/locale';
import React, { useMemo } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

import { FormComponentProps } from '../types/FormComponentProps';
import { ParsedJD } from '../types/ParsedJD';
import { StyledSection, StyledSectionContent } from './ArxJDUploadModal.styled';

const StyledLabel = styled.div`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin-bottom: ${themeCssVariables.spacing[2]};
  text-align: center;
  width: 100%;
`;

const StyledDateSlotContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  margin-top: ${themeCssVariables.spacing[2]};
`;

const StyledDateSlot = styled.div`
  align-items: center;
  background-color: ${themeCssVariables.background.secondary};
  border-radius: ${themeCssVariables.border.radius.sm};
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]};
`;

const StyledCalendarContainer = styled.div`
  display: flex;
  justify-content: center;
  margin: ${themeCssVariables.spacing[2]} 0;

  .react-datepicker {
    background-color: ${themeCssVariables.background.primary};
    border: 1px solid ${themeCssVariables.border.color.medium};
    border-radius: ${themeCssVariables.border.radius.md};
    font-family: inherit;
  }

  .react-datepicker__day--highlighted {
    background-color: ${themeCssVariables.color.blue};
    border-radius: ${themeCssVariables.border.radius.sm};
    color: ${themeCssVariables.font.color.inverted};
  }
`;

const StyledFlexContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
`;

const StyledMeetingTypeContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  margin-bottom: ${themeCssVariables.spacing[4]};
`;

const StyledRadioOption = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

export const MeetingSchedulingSection: React.FC<FormComponentProps> = ({
  parsedJD,
  setParsedJD,
}) => {
  const selectedDates = useMemo(
    () =>
      parsedJD?.meetingScheduling.availableDates.map(
        (availableDate) => new Date(availableDate.date),
      ) ?? [],
    [parsedJD?.meetingScheduling.availableDates],
  );

  if (!parsedJD) {
    return null;
  }

  // Prevent hotkey propagation when interacting with calendar
  const handleKeyDown = (event: React.KeyboardEvent) => {
    event.stopPropagation();
  };

  const handleDateSelect = (date: Date | null) => {
    if (!date) {
      return;
    }

    const dateStr = date.toISOString();
    const existingDateIndex =
      parsedJD.meetingScheduling.availableDates.findIndex(
        (availableDate: { date: string }) =>
          availableDate.date.split('T')[0] === dateStr.split('T')[0],
      );

    if (existingDateIndex === -1) {
      setParsedJD({
        ...parsedJD,
        meetingScheduling: {
          ...parsedJD.meetingScheduling,
          availableDates: [
            ...parsedJD.meetingScheduling.availableDates,
            {
              date: dateStr,
              timeSlots: {
                morning: false,
                afternoon: false,
                evening: false,
              },
            },
          ],
        },
      } as ParsedJD);
    } else {
      setParsedJD({
        ...parsedJD,
        meetingScheduling: {
          ...parsedJD.meetingScheduling,
          availableDates: parsedJD.meetingScheduling.availableDates.filter(
            (_: unknown, index: number) => index !== existingDateIndex,
          ),
        },
      } as ParsedJD);
    }
  };

  const toggleTimeSlot = (
    dateIndex: number,
    slot: 'morning' | 'afternoon' | 'evening',
  ) => {
    setParsedJD({
      ...parsedJD,
      meetingScheduling: {
        ...parsedJD.meetingScheduling,
        availableDates: parsedJD.meetingScheduling.availableDates.map(
          (availableDate, index) =>
            index === dateIndex
              ? {
                  ...availableDate,
                  timeSlots: {
                    ...availableDate.timeSlots,
                    [slot]: !availableDate.timeSlots[slot],
                  },
                }
              : availableDate,
        ),
      },
    } as ParsedJD);
  };

  const handleMeetingTypeChange = (type: 'walkIn' | 'online' | 'inPerson') => {
    setParsedJD({
      ...parsedJD,
      meetingScheduling: {
        ...parsedJD.meetingScheduling,
        meetingType: type,
      },
    } as ParsedJD);
  };

  return (
    <StyledSection>
      <StyledSectionContent>
        <StyledFlexContainer>
          <StyledMeetingTypeContainer>
            <StyledLabel>Meeting Type</StyledLabel>
            <StyledRadioOption>
              <Radio
                checked={parsedJD.meetingScheduling.meetingType === 'walkIn'}
                onChange={() => handleMeetingTypeChange('walkIn')}
              />
              <span>Walk-in</span>
            </StyledRadioOption>
            <StyledRadioOption>
              <Radio
                checked={parsedJD.meetingScheduling.meetingType === 'online'}
                onChange={() => handleMeetingTypeChange('online')}
              />
              <span>Online</span>
            </StyledRadioOption>
            <StyledRadioOption>
              <Radio
                checked={parsedJD.meetingScheduling.meetingType === 'inPerson'}
                onChange={() => handleMeetingTypeChange('inPerson')}
              />
              <span>In Person</span>
            </StyledRadioOption>
          </StyledMeetingTypeContainer>

          {(parsedJD.meetingScheduling.meetingType === 'online' ||
            parsedJD.meetingScheduling.meetingType === 'inPerson') && (
            <>
              <StyledLabel style={{ marginTop: themeCssVariables.spacing[0] }}>
                Select Available Dates & Time Slots
              </StyledLabel>
              <div
                onClick={(event: React.MouseEvent) => event.stopPropagation()}
                onKeyDown={handleKeyDown}
              >
                <StyledCalendarContainer>
                  <DatePicker
                    inline
                    selected={null}
                    onChange={handleDateSelect}
                    minDate={new Date()}
                    maxDate={addDays(new Date(), 90)}
                    highlightDates={selectedDates}
                    locale={enUS}
                  />
                </StyledCalendarContainer>

                <StyledDateSlotContainer>
                  {parsedJD.meetingScheduling.availableDates.map(
                    (availableDate, index) => (
                      <StyledDateSlot key={availableDate.date}>
                        <span>
                          {new Date(availableDate.date).toLocaleDateString()}
                        </span>
                        <MenuItemSelect
                          selected={availableDate.timeSlots.morning}
                          onClick={() => toggleTimeSlot(index, 'morning')}
                          text="Morning (9 AM - 12 PM)"
                        />
                        <MenuItemSelect
                          selected={availableDate.timeSlots.afternoon}
                          onClick={() => toggleTimeSlot(index, 'afternoon')}
                          text="Afternoon (12 PM - 5 PM)"
                        />
                        <MenuItemSelect
                          selected={availableDate.timeSlots.evening}
                          onClick={() => toggleTimeSlot(index, 'evening')}
                          text="Evening (5 PM - 8 PM)"
                        />
                        <Button
                          variant="secondary"
                          title="Remove"
                          Icon={IconMinus}
                          onClick={() =>
                            setParsedJD({
                              ...parsedJD,
                              meetingScheduling: {
                                ...parsedJD.meetingScheduling,
                                availableDates:
                                  parsedJD.meetingScheduling.availableDates.filter(
                                    (_, dateIndex) => dateIndex !== index,
                                  ),
                              },
                            } as ParsedJD)
                          }
                        />
                      </StyledDateSlot>
                    ),
                  )}
                </StyledDateSlotContainer>
              </div>
            </>
          )}
        </StyledFlexContainer>
      </StyledSectionContent>
    </StyledSection>
  );
};
