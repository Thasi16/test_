/* Match the Windows float atan2 ABI without changing geometry or precision of
 * the recognition model. glibc atan2f differs by one ULP for valid ROI vectors;
 * the double evaluation rounded once to float matches the measured UCRT path.
 * This library is loaded only into the MediaPipe process, never TensorFlow. */
#include <math.h>

float atan2f(float y, float x) {
    return (float)atan2((double)y, (double)x);
}
